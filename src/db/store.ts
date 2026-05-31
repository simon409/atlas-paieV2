import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDrizzleDb, setupDatabase } from "./client.ts";
import type { DatabaseStatus, Employee, EmployeeDraft } from "./models.ts";
import { employees } from "./schema.ts";
import { DEFAULT_COMPANY_ID, ensureDefaultCompany, getActiveCompanyId } from "./companyStore.ts";

const LEGACY_EMPLOYEES_KEY = "atlas-paie.employees";
const DB_STATUS_KEY = "atlas-paie.db-status";
const MIGRATION_KEY = "atlas-paie.local-employees-migrated";

type EmployeeRow = typeof employees.$inferSelect;

export async function initializeAppDatabase(): Promise<DatabaseStatus> {
  try {
    await setupDatabase();
    await ensureDefaultCompany();
    await migrateLocalEmployeesToSqlite();
    await seedEmployees();
    await fixOrphanedEmployees();

    const status: DatabaseStatus = {
      provider: "sqlite",
      ready: true,
      message: "SQLite database is ready and employee data is using Drizzle.",
    };
    localStorage.setItem(DB_STATUS_KEY, JSON.stringify(status));
    return status;
  } catch (err) {
    const status: DatabaseStatus = {
      provider: "local",
      ready: false,
      message: `SQLite is not available yet: ${formatUnknownError(err)}`,
    };
    localStorage.setItem(DB_STATUS_KEY, JSON.stringify(status));
    return status;
  }
}

export function getDatabaseStatus(): DatabaseStatus {
  const raw = localStorage.getItem(DB_STATUS_KEY);
  if (!raw) {
    return {
      provider: "local",
      ready: false,
      message: "Database has not been initialized yet.",
    };
  }

  return JSON.parse(raw) as DatabaseStatus;
}

export async function listEmployees(): Promise<Employee[]> {
  await ensureReady();
  const companyId = await getActiveCompanyId();
  console.log("Listing employees for company ID:", companyId);
  const rows = await getDrizzleDb()
    .select()
    .from(employees)
    .where(eq(employees.companyId, companyId))
    .orderBy(asc(employees.fullName));
  return rows.map(fromEmployeeRow);
}

export async function createEmployee(draft: EmployeeDraft): Promise<Employee> {
  await ensureReady();
  const employee: Employee = {
    ...draft,
    id: crypto.randomUUID(),
    companyId: await getActiveCompanyId(),
    status: draft.status ?? "ACTIVE",
  };

  await getDrizzleDb().insert(employees).values(toEmployeeRow(employee)).run();
  return employee;
}

export async function updateEmployee(id: string, patch: Partial<EmployeeDraft>): Promise<Employee> {
  await ensureReady();
  const existing = await getEmployee(id);
  if (!existing) throw new Error("Employee not found");

  const updated: Employee = {
    ...existing,
    ...patch,
    status: patch.status ?? existing.status,
  };

  await getDrizzleDb().update(employees).set(toEmployeeRow(updated)).where(eq(employees.id, id)).run();
  return updated;
}

export async function deleteEmployee(id: string): Promise<void> {
  await ensureReady();
  await getDrizzleDb().delete(employees).where(eq(employees.id, id)).run();
}

async function ensureReady(): Promise<void> {
  await setupDatabase();
  await ensureDefaultCompany();
}

async function getEmployee(id: string): Promise<Employee | null> {
  const row = await getDrizzleDb().select().from(employees).where(eq(employees.id, id)).get();
  return row ? fromEmployeeRow(row) : null;
}

async function seedEmployees(): Promise<void> {
  const companyId = await getActiveCompanyId();
  if (companyId !== DEFAULT_COMPANY_ID) return;

  const rows = await getDrizzleDb().select().from(employees).where(eq(employees.companyId, companyId)).get();
  if (rows) return;

  await getDrizzleDb()
    .insert(employees)
    .values([
      toEmployeeRow({
        id: "emp-demo-1",
        matricule: "EMP001",
        cin: "AB123456",
        cnssNumber: "123456789",
        fullName: "Yassine El Amrani",
        hireDate: "2024-01-15",
        seniorityDate: "2024-01-15",
        birthDate: "",
        familyStatus: "",
        childrenCount: 0,
        deductionCount: 0,
        functionTitle: "Employe",
        department: "Production",
        contractType: "CDI",
        salaryBase: 6500,
        status: "ACTIVE",
        companyId,
      }),
      toEmployeeRow({
        id: "emp-demo-2",
        matricule: "EMP002",
        cin: "CD987654",
        cnssNumber: "987654321",
        fullName: "Salma Benali",
        hireDate: "2023-09-01",
        seniorityDate: "2023-09-01",
        birthDate: "",
        familyStatus: "",
        childrenCount: 0,
        deductionCount: 0,
        functionTitle: "Employe",
        department: "Administration",
        contractType: "CDI",
        salaryBase: 12000,
        status: "ACTIVE",
        companyId,
      }),
    ])
    .run();
}

async function fixOrphanedEmployees(): Promise<void> {
  await getDrizzleDb()
    .update(employees)
    .set({ companyId: DEFAULT_COMPANY_ID })
    .where(inArray(employees.companyId, ["undefined", ""]))
    .run();
}

async function migrateLocalEmployeesToSqlite(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY) === "true") return;

  const raw = localStorage.getItem(LEGACY_EMPLOYEES_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_KEY, "true");
    return;
  }

  const legacyEmployees = JSON.parse(raw) as Employee[];
  for (const employee of legacyEmployees) {
    const existing = await getDrizzleDb().select().from(employees).where(eq(employees.id, employee.id)).get();
    if (!existing) {
      await getDrizzleDb().insert(employees).values(toEmployeeRow(employee)).run();
    }
  }

  localStorage.setItem(MIGRATION_KEY, "true");
}

function toEmployeeRow(employee: Employee): EmployeeRow {
  return {
    id: employee.id,
    matricule: employee.matricule,
    cin: employee.cin,
    cnssNumber: employee.cnssNumber || null,
    fullName: employee.fullName,
    hireDate: employee.hireDate,
    seniorityDate: employee.seniorityDate || null,
    birthDate: employee.birthDate || null,
    familyStatus: employee.familyStatus || null,
    childrenCount: employee.childrenCount,
    deductionCount: employee.deductionCount,
    functionTitle: employee.functionTitle || null,
    department: employee.department || null,
    contractType: employee.contractType,
    salaryBase: moneyToCents(employee.salaryBase),
    status: employee.status,
    companyId: employee.companyId,
  };
}

function fromEmployeeRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    matricule: row.matricule,
    cin: row.cin,
    cnssNumber: row.cnssNumber ?? "",
    fullName: row.fullName,
    hireDate: row.hireDate,
    seniorityDate: row.seniorityDate ?? row.hireDate,
    birthDate: row.birthDate ?? "",
    familyStatus: row.familyStatus ?? "",
    childrenCount: row.childrenCount ?? 0,
    deductionCount: row.deductionCount ?? 0,
    functionTitle: row.functionTitle ?? "",
    department: row.department ?? "",
    contractType: row.contractType as Employee["contractType"],
    salaryBase: centsToMoney(row.salaryBase),
    status: row.status as Employee["status"],
    companyId: row.companyId,
  };
}

function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

function centsToMoney(value: number): number {
  return value / 100;
}

export async function listDepartments(): Promise<string[]> {
  await ensureReady();
  const companyId = await getActiveCompanyId();
  const rows = await getDrizzleDb()
    .select({ department: employees.department })
    .from(employees)
    .where(and(eq(employees.companyId, companyId), sql`${employees.department} != ''`))
    .groupBy(employees.department)
    .orderBy(asc(employees.department))
    .all();
  return rows.map((r) => r.department).filter(Boolean) as string[];
}

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown database error";
  }
}
