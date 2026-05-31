import { and, desc, eq } from "drizzle-orm";
import { getDrizzleDb, setupDatabase } from "./client.ts";
import type { Declaration, DeclarationLine, DeclarationType } from "./models.ts";
import { declarationLines, declarations, payrollRuns } from "./schema.ts";
import { getActiveCompanyId } from "./companyStore.ts";
import { listPayrollItems } from "./payrollRunStore.ts";

type DeclarationRow = typeof declarations.$inferSelect;
type DeclarationLineRow = typeof declarationLines.$inferSelect;

export async function listDeclarations(type?: DeclarationType): Promise<Declaration[]> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const conditions = [eq(declarations.companyId, companyId)];
  if (type) conditions.push(eq(declarations.type, type));
  const rows = await getDrizzleDb()
    .select()
    .from(declarations)
    .where(and(...conditions))
    .orderBy(desc(declarations.generatedAt));
  return rows.map(fromDeclarationRow);
}

export async function getDeclaration(id: string): Promise<Declaration | null> {
  await setupDatabase();
  const row = await getDrizzleDb().select().from(declarations).where(eq(declarations.id, id)).get();
  return row ? fromDeclarationRow(row) : null;
}

export async function getDeclarationLines(declarationId: string): Promise<DeclarationLine[]> {
  await setupDatabase();
  const rows = await getDrizzleDb()
    .select()
    .from(declarationLines)
    .where(eq(declarationLines.declarationId, declarationId));
  return rows.map(fromDeclarationLineRow);
}

export async function generateCnssDeclaration(payrollRunId: string): Promise<Declaration> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const items = await listPayrollItems(payrollRunId);
  if (items.length === 0) throw new Error("Aucun résultat de paie trouvé pour ce traitement");

  const run = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, payrollRunId))
    .get();

  if (!run) throw new Error("Traitement introuvable");
  if (run.status !== "LOCKED") throw new Error("Le traitement doit être verrouillé avant de générer une déclaration");

  const now = new Date();
  const declarationId = crypto.randomUUID();

  const lines: DeclarationLine[] = items.map((item) => {
    const empSnapshot = safeParseJson(item.employeeSnapshot, {});
    const cnssBase = Math.min(item.grossSalary, 6000);
    return {
      id: crypto.randomUUID(),
      declarationId,
      employeeId: item.employeeId,
      matricule: item.employeeMatricule,
      fullName: item.employeeName,
      cnssNumber: (empSnapshot.cnssNumber as string) ?? null,
      cin: (empSnapshot.cin as string) ?? "",
      grossSalary: item.grossSalary,
      cnssBase,
      amoBase: item.grossSalary,
      employeeCnss: item.cnssEmployee,
      employerCnss: item.cnssEmployer,
      employeeAmo: item.amo,
      employerAmo: item.amo,
      ir: item.ir,
      netSalary: item.netSalary,
      familyAllowance: item.familyAllowance,
    };
  });

  const totals = {
    employeeCount: lines.length,
    totalGross: sum(lines, "grossSalary"),
    totalCnssBase: sumNullable(lines, "cnssBase"),
    totalAmoBase: sumNullable(lines, "amoBase"),
    totalEmployeeCnss: sumNullable(lines, "employeeCnss"),
    totalEmployerCnss: sumNullable(lines, "employerCnss"),
    totalEmployeeAmo: sumNullable(lines, "employeeAmo"),
    totalEmployerAmo: sumNullable(lines, "employerAmo"),
    totalIr: sumNullable(lines, "ir"),
    totalNet: sumNullable(lines, "netSalary"),
    totalFamilyAllowance: sumNullable(lines, "familyAllowance"),
  };

  const declaration: Declaration = {
    id: declarationId,
    companyId,
    type: "CNSS",
    period: run.period,
    payrollRunId,
    status: "GENERATED",
    generatedAt: now,
    exported: false,
    totals,
  };

  await getDrizzleDb()
    .insert(declarations)
    .values(toDeclarationRow(declaration))
    .run();
  await getDrizzleDb()
    .insert(declarationLines)
    .values(lines.map(toDeclarationLineRow))
    .run();

  return declaration;
}

export async function generateIrDeclaration(payrollRunId: string): Promise<Declaration> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const items = await listPayrollItems(payrollRunId);
  if (items.length === 0) throw new Error("Aucun résultat de paie trouvé pour ce traitement");

  const run = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, payrollRunId))
    .get();

  if (!run) throw new Error("Traitement introuvable");
  if (run.status !== "LOCKED") throw new Error("Le traitement doit être verrouillé avant de générer une déclaration");

  const now = new Date();
  const declarationId = crypto.randomUUID();

  const lines: DeclarationLine[] = items.map((item) => ({
    id: crypto.randomUUID(),
    declarationId,
    employeeId: item.employeeId,
    matricule: item.employeeMatricule,
    fullName: item.employeeName,
    cnssNumber: null,
    cin: "",
    grossSalary: item.grossSalary,
    cnssBase: null,
    amoBase: null,
    employeeCnss: null,
    employerCnss: null,
    employeeAmo: null,
    employerAmo: null,
    ir: item.ir,
    netSalary: item.netSalary,
    familyAllowance: null,
  }));

  const totals = {
    employeeCount: lines.length,
    totalGross: sum(lines, "grossSalary"),
    totalCnssBase: 0,
    totalAmoBase: 0,
    totalEmployeeCnss: 0,
    totalEmployerCnss: 0,
    totalEmployeeAmo: 0,
    totalEmployerAmo: 0,
    totalIr: sumNullable(lines, "ir"),
    totalNet: sumNullable(lines, "netSalary"),
    totalFamilyAllowance: 0,
  };

  const declaration: Declaration = {
    id: declarationId,
    companyId,
    type: "IR",
    period: run.period,
    payrollRunId,
    status: "GENERATED",
    generatedAt: now,
    exported: false,
    totals,
  };

  await getDrizzleDb()
    .insert(declarations)
    .values(toDeclarationRow(declaration))
    .run();
  await getDrizzleDb()
    .insert(declarationLines)
    .values(lines.map(toDeclarationLineRow))
    .run();

  return declaration;
}

export async function deleteDeclaration(id: string): Promise<void> {
  await setupDatabase();
  await getDrizzleDb().delete(declarationLines).where(eq(declarationLines.declarationId, id)).run();
  await getDrizzleDb().delete(declarations).where(eq(declarations.id, id)).run();
}

export async function markDeclarationExported(id: string): Promise<Declaration> {
  await setupDatabase();
  const decl = await getDeclaration(id);
  if (!decl) throw new Error("Déclaration introuvable");
  const updated: Declaration = { ...decl, exported: true };
  await getDrizzleDb()
    .update(declarations)
    .set(toDeclarationRow(updated))
    .where(eq(declarations.id, id))
    .run();
  return updated;
}

// -- Row converters --

function toDeclarationRow(decl: Declaration): DeclarationRow {
  return {
    id: decl.id,
    companyId: decl.companyId,
    type: decl.type,
    period: decl.period,
    payrollRunId: decl.payrollRunId,
    status: decl.status,
    generatedAt: decl.generatedAt,
    exported: decl.exported ? 1 : 0,
    totalsJson: JSON.stringify(decl.totals),
  };
}

function fromDeclarationRow(row: DeclarationRow): Declaration {
  return {
    id: row.id,
    companyId: row.companyId,
    type: row.type as DeclarationType,
    period: row.period,
    payrollRunId: row.payrollRunId,
    status: row.status as Declaration["status"],
    generatedAt: row.generatedAt,
    exported: row.exported === 1,
    totals: JSON.parse(row.totalsJson),
  };
}

function toDeclarationLineRow(line: DeclarationLine): DeclarationLineRow {
  return {
    id: line.id,
    declarationId: line.declarationId,
    employeeId: line.employeeId,
    matricule: line.matricule,
    fullName: line.fullName,
    cnssNumber: line.cnssNumber,
    cin: line.cin,
    grossSalary: moneyToCents(line.grossSalary),
    cnssBase: nullableMoneyToCents(line.cnssBase),
    amoBase: nullableMoneyToCents(line.amoBase),
    employeeCnss: nullableMoneyToCents(line.employeeCnss),
    employerCnss: nullableMoneyToCents(line.employerCnss),
    employeeAmo: nullableMoneyToCents(line.employeeAmo),
    employerAmo: nullableMoneyToCents(line.employerAmo),
    ir: nullableMoneyToCents(line.ir),
    netSalary: nullableMoneyToCents(line.netSalary),
    familyAllowance: nullableMoneyToCents(line.familyAllowance),
  };
}

function fromDeclarationLineRow(row: DeclarationLineRow): DeclarationLine {
  return {
    id: row.id,
    declarationId: row.declarationId,
    employeeId: row.employeeId,
    matricule: row.matricule,
    fullName: row.fullName,
    cnssNumber: row.cnssNumber,
    cin: row.cin,
    grossSalary: centsToMoney(row.grossSalary),
    cnssBase: nullableCentsToMoney(row.cnssBase),
    amoBase: nullableCentsToMoney(row.amoBase),
    employeeCnss: nullableCentsToMoney(row.employeeCnss),
    employerCnss: nullableCentsToMoney(row.employerCnss),
    employeeAmo: nullableCentsToMoney(row.employeeAmo),
    employerAmo: nullableCentsToMoney(row.employerAmo),
    ir: nullableCentsToMoney(row.ir),
    netSalary: nullableCentsToMoney(row.netSalary),
    familyAllowance: nullableCentsToMoney(row.familyAllowance),
  };
}

// -- Helpers --

function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

function nullableMoneyToCents(value: number | null): number | null {
  return value === null ? null : moneyToCents(value);
}

function centsToMoney(value: number): number {
  return value / 100;
}

function nullableCentsToMoney(value: number | null): number | null {
  return value === null ? null : centsToMoney(value);
}

function sum<T>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

function sumNullable<T>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => {
    const val = item[key];
    return total + (val === null ? 0 : Number(val));
  }, 0);
}

function safeParseJson(json: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}
