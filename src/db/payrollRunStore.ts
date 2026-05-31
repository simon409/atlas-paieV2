import { and, desc, eq } from "drizzle-orm";
import { calculatePayroll } from "../payroll/engine/grossToNet.ts";
import rules2026 from "../payroll/rules/2026.json";
import type { PayrollRules } from "../payroll/rules/types.ts";
import type { PayrollInput, PayrollResult } from "../types/payroll.types.ts";
import { getDrizzleDb, setupDatabase } from "./client.ts";
import type { Employee, PayrollItem, PayrollItemLine, PayrollMovement, PayrollRun } from "./models.ts";
import { listEmployees } from "./store.ts";
import { payrollItemLines, payrollItems, payrollRuns } from "./schema.ts";
import { listMovements, getMovementTotals } from "./movementStore.ts";
import { getActiveCompanyId } from "./companyStore.ts";

const rules = rules2026 as PayrollRules;

type PayrollRunRow = typeof payrollRuns.$inferSelect;
type PayrollItemRow = typeof payrollItems.$inferSelect;
type PayrollItemLineRow = typeof payrollItemLines.$inferSelect;

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const rows = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.companyId, companyId))
    .orderBy(desc(payrollRuns.period));
  return rows.map(fromPayrollRunRow);
}

export async function listPayrollItems(payrollRunId: string): Promise<PayrollItem[]> {
  await setupDatabase();
  const rows = await getDrizzleDb().select().from(payrollItems).where(eq(payrollItems.payrollRunId, payrollRunId));
  return rows.map(fromPayrollItemRow);
}

export async function listPayrollItemLines(payrollItemId: string): Promise<PayrollItemLine[]> {
  await setupDatabase();
  const rows = await getDrizzleDb().select().from(payrollItemLines).where(eq(payrollItemLines.payrollItemId, payrollItemId));
  return rows.map(fromPayrollItemLineRow).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPayrollRun(id: string): Promise<PayrollRun | null> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const row = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.companyId, companyId)))
    .get();
  return row ? fromPayrollRunRow(row) : null;
}

export async function generatePayrollRun(period: string): Promise<{ run: PayrollRun; items: PayrollItem[] }> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();

  // Replace any existing run for this period
  const existingRunRow = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.period, period), eq(payrollRuns.companyId, companyId)))
    .get();
  if (existingRunRow) {
    await deletePayrollRun(existingRunRow.id);
  }

  const activeEmployees = (await listEmployees()).filter((employee) => employee.status === "ACTIVE");
  if (activeEmployees.length === 0) {
    throw new Error("No active employees found");
  }

  const runId = crypto.randomUUID();
  const { dateDebut, dateFin } = periodToDateRange(period);

  // Batch-fetch all movements + carry forwards once, not per employee
  const [allMovements, carryForwardMap] = await Promise.all([
    listMovements(dateDebut, dateFin),
    buildCarryForwardMap(),
  ]);

  const generated = await Promise.all(
    activeEmployees.map(async (employee) => {
      const movementTotals = computeMovementTotals(allMovements, employee.id);
      const input = buildInput(employee, movementTotals);
      const result = calculatePayroll(input, rules);
      const item = await buildPayrollItem(runId, employee, input, result);

      const previousCF = carryForwardMap.get(employee.id) ?? 0;
      const { netSalary, carryForward } = roundNetWithCarryForward(item.netSalary, previousCF);
      const roundingDiff = netSalary - item.netSalary;
      item.netSalary = netSalary;
      item.roundingCarryForward = carryForward;
      item.roundingDiff = roundingDiff;

      const lines = buildPayrollItemLines(item.id, result, movementTotals.labels, previousCF, carryForward);
      return { item, lines };
    }),
  );
  const generatedItems = generated.map((entry) => entry.item);
  const generatedLines = generated.flatMap((entry) => entry.lines);

  const run: PayrollRun = {
    id: runId,
    companyId,
    period,
    ruleVersion: rules.year,
    status: "DRAFT",
    totalGross: sum(generatedItems, "grossSalary"),
    totalNet: sum(generatedItems, "netSalary"),
    totalEmployerCost: generatedItems.reduce(
      (total, item) => total + item.grossSalary + item.cnssEmployer + item.amo + item.familyAllowance,
      0,
    ),
  };

  await getDrizzleDb().insert(payrollRuns).values(toPayrollRunRow(run)).run();
  await getDrizzleDb().insert(payrollItems).values(generatedItems.map(toPayrollItemRow)).run();
  await getDrizzleDb().insert(payrollItemLines).values(generatedLines.map(toPayrollItemLineRow)).run();

  return {
    run,
    items: generatedItems,
  };
}

export async function recalculatePayrollItem(runId: string, itemId: string): Promise<PayrollItem> {
  await setupDatabase();

  const run = await getPayrollRun(runId);
  if (!run) throw new Error("Payroll run not found");

  const itemRow = await getDrizzleDb().select().from(payrollItems).where(eq(payrollItems.id, itemId)).get();
  if (!itemRow) throw new Error("Payroll item not found");
  const currentItem = fromPayrollItemRow(itemRow);

  const allEmployees = await listEmployees();
  const employee = allEmployees.find((e) => e.id === currentItem.employeeId);
  if (!employee) throw new Error("Employee not found");

  const { dateDebut, dateFin } = periodToDateRange(run.period);
  const movementTotals = await getMovementTotals(dateDebut, dateFin, employee.id);
  const input = buildInput(employee, movementTotals);
  const result = calculatePayroll(input, rules);

  // Build updated item (keep same ID)
  const updatedItem: PayrollItem = await buildPayrollItem(runId, employee, input, result);
  updatedItem.id = itemId;

  const previousCF = await getPreviousCarryForward(employee.id);
  const { netSalary, carryForward } = roundNetWithCarryForward(updatedItem.netSalary, previousCF);
  const roundingDiff = netSalary - updatedItem.netSalary;
  updatedItem.netSalary = netSalary;
  updatedItem.roundingCarryForward = carryForward;
  updatedItem.roundingDiff = roundingDiff;

  // Delete old lines, insert new ones
  await getDrizzleDb().delete(payrollItemLines).where(eq(payrollItemLines.payrollItemId, itemId)).run();
  const lines = buildPayrollItemLines(itemId, result, movementTotals.labels, previousCF, carryForward);
  await getDrizzleDb().insert(payrollItemLines).values(lines.map(toPayrollItemLineRow)).run();
  await getDrizzleDb().update(payrollItems).set(toPayrollItemRow(updatedItem)).where(eq(payrollItems.id, itemId)).run();

  // Recalculate run totals
  const allItems = await listPayrollItems(runId);
  const updatedRun: PayrollRun = {
    ...run,
    totalGross: allItems.reduce((s, i) => s + i.grossSalary, 0),
    totalNet: allItems.reduce((s, i) => s + i.netSalary, 0),
    totalEmployerCost: allItems.reduce((s, i) => s + i.grossSalary + i.cnssEmployer + i.amo + i.familyAllowance, 0),
  };
  await getDrizzleDb().update(payrollRuns).set(toPayrollRunRow(updatedRun)).where(eq(payrollRuns.id, runId)).run();

  return updatedItem;
}

export async function updatePayrollRunStatus(id: string, status: PayrollRun["status"]): Promise<PayrollRun> {
  await setupDatabase();
  const run = await getPayrollRun(id);
  if (!run) throw new Error("Traitement introuvable");

  const updated: PayrollRun = { ...run, status };
  await getDrizzleDb().update(payrollRuns).set(toPayrollRunRow(updated)).where(eq(payrollRuns.id, id)).run();
  return updated;
}

export async function deletePayrollRun(id: string): Promise<void> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const items = await listPayrollItems(id);
  for (const item of items) {
    await getDrizzleDb().delete(payrollItemLines).where(eq(payrollItemLines.payrollItemId, item.id)).run();
  }
  await getDrizzleDb().delete(payrollItems).where(eq(payrollItems.payrollRunId, id)).run();
  await getDrizzleDb()
    .delete(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.companyId, companyId)))
    .run();
}

function periodToDateRange(period: string): { dateDebut: string; dateFin: string } {
  const [y, m] = period.split("-");
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return {
    dateDebut: `${y}-${m}-01`,
    dateFin: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

function buildInput(
  employee: Employee,
  movementTotals: { allowances: number; bonuses: number; deductions: number },
): PayrollInput {
  return {
    baseSalary: employee.salaryBase,
    allowances: movementTotals.allowances,
    bonuses: movementTotals.bonuses,
    deductions: movementTotals.deductions,
    dependentsCount: employee.deductionCount,
    childrenCount: employee.childrenCount,
    irMode: "legal_simulation",
  };
}

function computeMovementTotals(
  movements: PayrollMovement[],
  employeeId: string,
): { allowances: number; bonuses: number; deductions: number; labels: { allowances: string[]; bonuses: string[]; deductions: string[] } } {
  return movements.reduce(
    (acc, m) => {
      if (m.scope === "employee" && m.employeeId !== employeeId) return acc;
      if (m.type === "BONUS") {
        acc.bonuses += m.amount;
        if (m.label) acc.labels.bonuses.push(m.label);
      } else if (m.type === "TAXABLE_ALLOWANCE" || m.type === "NON_TAXABLE_ALLOWANCE") {
        acc.allowances += m.amount;
        if (m.label) acc.labels.allowances.push(m.label);
      } else if (m.type === "DEDUCTION") {
        acc.deductions += m.amount;
        if (m.label) acc.labels.deductions.push(m.label);
      }
      return acc;
    },
    { allowances: 0, bonuses: 0, deductions: 0, labels: { allowances: [] as string[], bonuses: [] as string[], deductions: [] as string[] } },
  );
}

async function buildCarryForwardMap(): Promise<Map<string, number>> {
  await setupDatabase();
  const allItems = await getDrizzleDb().select().from(payrollItems).all();
  if (allItems.length === 0) return new Map();

  const allRuns = await getDrizzleDb().select().from(payrollRuns).all();
  const runPeriods = Object.fromEntries(allRuns.map((r) => [r.id, r.period]));

  const employeeItems = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const existing = employeeItems.get(item.employeeId) ?? [];
    existing.push(item);
    employeeItems.set(item.employeeId, existing);
  }

  const map = new Map<string, number>();
  for (const [employeeId, items] of employeeItems) {
    const latest = items
      .filter((i) => runPeriods[i.payrollRunId])
      .sort((a, b) => runPeriods[b.payrollRunId].localeCompare(runPeriods[a.payrollRunId]))[0];
    if (latest) {
      map.set(employeeId, centsToMoney(latest.roundingCarryForward ?? 0));
    }
  }
  return map;
}

async function getPreviousCarryForward(employeeId: string): Promise<number> {
  await setupDatabase();
  // Collect items for this employee and their run periods to find the latest
  const items = await getDrizzleDb()
    .select()
    .from(payrollItems)
    .where(eq(payrollItems.employeeId, employeeId))
    .all();
  if (items.length === 0) return 0;

  const runs = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .all();
  const runPeriods = Object.fromEntries(runs.map((r) => [r.id, r.period]));

  const latest = items
    .filter((i) => runPeriods[i.payrollRunId])
    .sort((a, b) => runPeriods[b.payrollRunId].localeCompare(runPeriods[a.payrollRunId]))[0];

  if (!latest) return 0;
  return centsToMoney(latest.roundingCarryForward ?? 0);
}

function roundNetWithCarryForward(
  exactNet: number,
  previousCarryForward: number,
): { netSalary: number; carryForward: number } {
  const netBeforeRound = exactNet - previousCarryForward;
  const roundedNet = Math.ceil(netBeforeRound);
  const carryForward = roundedNet - netBeforeRound;
  return { netSalary: roundedNet, carryForward };
}

function buildPayrollItemLines(
  payrollItemId: string,
  result: PayrollResult,
  movementLabels: {
    allowances: string[];
    bonuses: string[];
    deductions: string[];
  },
  previousCarryForward: number,
  currentCarryForward: number,
): PayrollItemLine[] {
  const lines: PayrollItemLine[] = [
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "BASE_SALARY",
      label: "Salaire de base",
      type: "EARNING",
      baseAmount: null,
      rate: null,
      amount: result.breakdown.baseSalary,
      sortOrder: 10,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "ALLOWANCES",
      label: formatMovementLabel("Indemnités", movementLabels.allowances),
      type: "EARNING",
      baseAmount: null,
      rate: null,
      amount: result.breakdown.allowances,
      sortOrder: 20,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "BONUSES",
      label: formatMovementLabel("Primes", movementLabels.bonuses),
      type: "EARNING",
      baseAmount: null,
      rate: null,
      amount: result.breakdown.bonuses,
      sortOrder: 30,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "DEDUCTIONS_INPUT",
      label: formatMovementLabel("Déductions d'entrée", movementLabels.deductions),
      type: "DEDUCTION",
      baseAmount: null,
      rate: null,
      amount: -result.breakdown.deductions,
      sortOrder: 40,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "CNSS_EMPLOYEE",
      label: "CNSS employé",
      type: "DEDUCTION",
      baseAmount: Math.min(result.grossSalary, 6000),
      rate: 0.0448,
      amount: -result.cnssEmployee,
      sortOrder: 50,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "AMO_EMPLOYEE",
      label: "AMO employé",
      type: "DEDUCTION",
      baseAmount: result.grossSalary,
      rate: 0.0226,
      amount: -result.amoEmployee,
      sortOrder: 60,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "FRAIS_PRO",
      label: "Frais professionnels",
      type: "INFO",
      baseAmount: result.grossSalary,
      rate: 0.2,
      amount: -result.fraisProfessionnels,
      sortOrder: 70,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "IR",
      label: "Impôt sur le revenu",
      type: "DEDUCTION",
      baseAmount: result.netTaxable,
      rate: null,
      amount: -result.irNet,
      sortOrder: 80,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "CNSS_EMPLOYER",
      label: "CNSS employeur",
      type: "EMPLOYER",
      baseAmount: Math.min(result.grossSalary, 6000),
      rate: 0.0898,
      amount: result.cnssEmployer,
      sortOrder: 90,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "AMO_EMPLOYER",
      label: "AMO employeur",
      type: "EMPLOYER",
      baseAmount: result.grossSalary,
      rate: 0.0411,
      amount: result.amoEmployer,
      sortOrder: 100,
    },
    {
      id: crypto.randomUUID(),
      payrollItemId,
      code: "FAMILY_ALLOWANCE",
      label: "Allocations familiales",
      type: "EARNING",
      baseAmount: null,
      rate: null,
      amount: result.familyAllowance,
      sortOrder: 105,
    },
  ];
  if (previousCarryForward > 0) {
    lines.push({
      id: crypto.randomUUID(),
      payrollItemId,
      code: "CARRIED_FORWARD",
      label: "Reprise arrondi mois préc.",
      type: "DEDUCTION",
      baseAmount: null,
      rate: null,
      amount: -previousCarryForward,
      sortOrder: 108,
    });
  }
  if (currentCarryForward > 0) {
    lines.push({
      id: crypto.randomUUID(),
      payrollItemId,
      code: "NET_ROUNDING",
      label: "Arrondi sur net",
      type: "EARNING",
      baseAmount: null,
      rate: null,
      amount: currentCarryForward,
      sortOrder: 110,
    });
  }
  return lines.filter((line) => line.amount !== 0 || line.type === "INFO");
}

function formatMovementLabel(defaultLabel: string, labels: string[]): string {
  if (labels.length === 0) return defaultLabel;
  if (labels.length === 1) return labels[0];
  return `${defaultLabel} (${labels.join(", ")})`;
}

async function buildPayrollItem(
  payrollRunId: string,
  employee: Employee,
  input: PayrollInput,
  result: PayrollResult,
): Promise<PayrollItem> {
  return {
    id: crypto.randomUUID(),
    payrollRunId,
    employeeId: employee.id,
    employeeName: employee.fullName,
    employeeMatricule: employee.matricule,
    rulesVersion: rules.year,
    rulesSnapshot: JSON.stringify(rules),
    inputSnapshot: JSON.stringify(input),
    calculationHash: await hashCalculation(input, result),
    grossSalary: result.grossSalary,
    netSalary: result.netSalary,
    cnssEmployee: result.cnssEmployee,
    cnssEmployer: result.cnssEmployer,
    ir: result.irNet,
    amo: result.amoEmployee,
    allowances: result.breakdown.allowances,
    bonuses: result.breakdown.bonuses,
    deductions: result.breakdown.deductions,
    taxableIncome: result.netTaxable,
    professionalExpenses: result.fraisProfessionnels,
    cumulativeTaxableIncome: result.annualization?.cumulativeTaxableIncome ?? null,
    previousIrWithheld: result.annualization?.previousIRWithheld ?? null,
    cumulativeIrDue: result.annualization?.cumulativeIRDue ?? null,
    roundingCarryForward: 0,
    roundingDiff: 0,
    familyAllowance: result.familyAllowance,
    employeeSnapshot: JSON.stringify({
      fullName: employee.fullName,
      matricule: employee.matricule,
      cin: employee.cin,
      cnssNumber: employee.cnssNumber,
      functionTitle: employee.functionTitle,
      department: employee.department,
      hireDate: employee.hireDate,
      seniorityDate: employee.seniorityDate,
      birthDate: employee.birthDate,
      familyStatus: employee.familyStatus,
      childrenCount: employee.childrenCount,
      deductionCount: employee.deductionCount,
      contractType: employee.contractType,
      salaryBase: employee.salaryBase,
    }),
    traceJson: JSON.stringify(result.trace),
  };
}

async function hashCalculation(input: PayrollInput, result: PayrollResult): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ input, result }));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toPayrollRunRow(run: PayrollRun): PayrollRunRow {
  return {
    id: run.id,
    companyId: run.companyId,
    period: run.period,
    ruleVersion: run.ruleVersion,
    status: run.status,
    totalGross: moneyToCents(run.totalGross),
    totalNet: moneyToCents(run.totalNet),
    totalEmployerCost: moneyToCents(run.totalEmployerCost),
  };
}

function fromPayrollRunRow(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    companyId: row.companyId,
    period: row.period,
    ruleVersion: row.ruleVersion,
    status: row.status as PayrollRun["status"],
    totalGross: centsToMoney(row.totalGross),
    totalNet: centsToMoney(row.totalNet),
    totalEmployerCost: centsToMoney(row.totalEmployerCost),
  };
}

function toPayrollItemRow(item: PayrollItem): PayrollItemRow {
  return {
    id: item.id,
    payrollRunId: item.payrollRunId,
    employeeId: item.employeeId,
    employeeName: item.employeeName,
    employeeMatricule: item.employeeMatricule,
    rulesVersion: item.rulesVersion,
    rulesSnapshot: item.rulesSnapshot,
    inputSnapshot: item.inputSnapshot,
    calculationHash: item.calculationHash,
    grossSalary: moneyToCents(item.grossSalary),
    netSalary: moneyToCents(item.netSalary),
    cnssEmployee: moneyToCents(item.cnssEmployee),
    cnssEmployer: moneyToCents(item.cnssEmployer),
    ir: moneyToCents(item.ir),
    amo: moneyToCents(item.amo),
    allowances: moneyToCents(item.allowances),
    bonuses: moneyToCents(item.bonuses),
    deductions: moneyToCents(item.deductions),
    taxableIncome: moneyToCents(item.taxableIncome),
    professionalExpenses: moneyToCents(item.professionalExpenses),
    cumulativeTaxableIncome: nullableMoneyToCents(item.cumulativeTaxableIncome),
    previousIrWithheld: nullableMoneyToCents(item.previousIrWithheld),
    cumulativeIrDue: nullableMoneyToCents(item.cumulativeIrDue),
    roundingCarryForward: moneyToCents(item.roundingCarryForward),
    roundingDiff: moneyToCents(item.roundingDiff),
    familyAllowance: moneyToCents(item.familyAllowance),
    employeeSnapshot: item.employeeSnapshot,
    traceJson: item.traceJson,
  };
}

function fromPayrollItemRow(row: PayrollItemRow): PayrollItem {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeMatricule: row.employeeMatricule,
    rulesVersion: row.rulesVersion,
    rulesSnapshot: row.rulesSnapshot,
    inputSnapshot: row.inputSnapshot,
    calculationHash: row.calculationHash,
    grossSalary: centsToMoney(row.grossSalary),
    netSalary: centsToMoney(row.netSalary),
    cnssEmployee: centsToMoney(row.cnssEmployee),
    cnssEmployer: centsToMoney(row.cnssEmployer),
    ir: centsToMoney(row.ir),
    amo: centsToMoney(row.amo),
    allowances: centsToMoney(row.allowances),
    bonuses: centsToMoney(row.bonuses),
    deductions: centsToMoney(row.deductions),
    taxableIncome: centsToMoney(row.taxableIncome),
    professionalExpenses: centsToMoney(row.professionalExpenses),
    cumulativeTaxableIncome: nullableCentsToMoney(row.cumulativeTaxableIncome),
    previousIrWithheld: nullableCentsToMoney(row.previousIrWithheld),
    cumulativeIrDue: nullableCentsToMoney(row.cumulativeIrDue),
    roundingCarryForward: centsToMoney(row.roundingCarryForward ?? 0),
    roundingDiff: centsToMoney(row.roundingDiff ?? 0),
    familyAllowance: centsToMoney(row.familyAllowance ?? 0),
    employeeSnapshot: row.employeeSnapshot,
    traceJson: row.traceJson,
  };
}

function toPayrollItemLineRow(line: PayrollItemLine): PayrollItemLineRow {
  return {
    id: line.id,
    payrollItemId: line.payrollItemId,
    code: line.code,
    label: line.label,
    type: line.type,
    baseAmount: nullableMoneyToCents(line.baseAmount),
    rate: line.rate === null ? null : Math.round(line.rate * 1000000),
    amount: moneyToCents(line.amount),
    sortOrder: line.sortOrder,
  };
}

function fromPayrollItemLineRow(row: PayrollItemLineRow): PayrollItemLine {
  return {
    id: row.id,
    payrollItemId: row.payrollItemId,
    code: row.code,
    label: row.label,
    type: row.type as PayrollItemLine["type"],
    baseAmount: nullableCentsToMoney(row.baseAmount),
    rate: row.rate === null ? null : row.rate / 1000000,
    amount: centsToMoney(row.amount),
    sortOrder: row.sortOrder,
  };
}

function sum<T>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

export async function getPreviousLockedRunItems(runId: string): Promise<Map<string, PayrollItem>> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();

  const currentRun = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.companyId, companyId)))
    .get();
  if (!currentRun) return new Map();

  const previousLockedRuns = await getDrizzleDb()
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.companyId, companyId), eq(payrollRuns.status, "LOCKED"), eq(payrollRuns.ruleVersion, currentRun.ruleVersion)))
    .orderBy(desc(payrollRuns.period))
    .all();

  const prevRun = previousLockedRuns.find((r) => r.period < currentRun.period);
  if (!prevRun) return new Map();

  const rows = await getDrizzleDb().select().from(payrollItems).where(eq(payrollItems.payrollRunId, prevRun.id)).all();
  const map = new Map<string, PayrollItem>();
  for (const row of rows) {
    map.set(row.employeeId, fromPayrollItemRow(row));
  }
  return map;
}

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
