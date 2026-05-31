import Database from "@tauri-apps/plugin-sql";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema.ts";

let dbPromise: Promise<Database> | null = null;
let drizzleDb: SqliteRemoteDatabase<typeof schema> | null = null;

export function getDatabase(): Promise<Database> {
  dbPromise ??= Database.load("sqlite:atlas-paie.db");
  return dbPromise;
}

export function getDrizzleDb(): SqliteRemoteDatabase<typeof schema> {
  drizzleDb ??= drizzle(
    async (query, params, method) => {
      const db = await getDatabase();

      if (method === "run") {
        await db.execute(query, params);
        return { rows: [] };
      }

      const result = await db.select<Array<Record<string, unknown> | unknown[]>>(query, params);
      const rows = result.map((row) => (Array.isArray(row) ? row : Object.values(row)));
      if (method === "get") {
        return { rows: rows[0] ?? [] };
      }

      return { rows };
    },
    { schema },
  );

  return drizzleDb;
}

export async function setupDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ice TEXT,
      cnss_affiliation TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      matricule TEXT NOT NULL UNIQUE,
      cin TEXT NOT NULL,
      cnss_number TEXT,
      full_name TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      seniority_date TEXT,
      birth_date TEXT,
      family_status TEXT,
      children_count INTEGER,
      deduction_count INTEGER,
      function_title TEXT,
      department TEXT,
      contract_type TEXT NOT NULL,
      salary_base INTEGER NOT NULL,
      status TEXT NOT NULL,
      company_id TEXT NOT NULL
    )
  `);
  await addColumnIfMissing("employees", "seniority_date", "TEXT");
  await addColumnIfMissing("employees", "birth_date", "TEXT");
  await addColumnIfMissing("employees", "family_status", "TEXT");
  await addColumnIfMissing("employees", "children_count", "INTEGER");
  await addColumnIfMissing("employees", "deduction_count", "INTEGER");
  await addColumnIfMissing("employees", "function_title", "TEXT");
  await addColumnIfMissing("employees", "department", "TEXT");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      period TEXT NOT NULL,
      rule_version INTEGER NOT NULL,
      status TEXT NOT NULL,
      total_gross INTEGER NOT NULL,
      total_net INTEGER NOT NULL,
      total_employer_cost INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_items (
      id TEXT PRIMARY KEY,
      payroll_run_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_matricule TEXT NOT NULL DEFAULT '',
      rules_version INTEGER NOT NULL,
      rules_snapshot TEXT NOT NULL,
      input_snapshot TEXT NOT NULL,
      calculation_hash TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      gross_salary INTEGER NOT NULL,
      net_salary INTEGER NOT NULL,
      cnss_employee INTEGER NOT NULL,
      cnss_employer INTEGER NOT NULL,
      ir INTEGER NOT NULL,
      amo INTEGER NOT NULL,
      allowances INTEGER NOT NULL,
      bonuses INTEGER NOT NULL,
      deductions INTEGER NOT NULL,
      taxable_income INTEGER NOT NULL,
      professional_expenses INTEGER NOT NULL,
      cumulative_taxable_income INTEGER,
      previous_ir_withheld INTEGER,
      cumulative_ir_due INTEGER,
      rounding_carry_forward INTEGER NOT NULL DEFAULT 0,
      rounding_diff INTEGER NOT NULL DEFAULT 0,
      trace_json TEXT NOT NULL
    )
  `);

  await addColumnIfMissing("payroll_items", "employee_name", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("payroll_items", "rounding_carry_forward", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("payroll_items", "rounding_diff", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("payroll_items", "employee_matricule", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("payroll_items", "bonuses", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("payroll_items", "taxable_income", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("payroll_items", "professional_expenses", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("payroll_items", "cumulative_taxable_income", "INTEGER");
  await addColumnIfMissing("payroll_items", "previous_ir_withheld", "INTEGER");
  await addColumnIfMissing("payroll_items", "cumulative_ir_due", "INTEGER");
  await addColumnIfMissing("payroll_items", "trace_json", "TEXT NOT NULL DEFAULT '[]'");
  await addColumnIfMissing("payroll_items", "family_allowance", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("payroll_items", "employee_snapshot", "TEXT NOT NULL DEFAULT '{}'");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_item_lines (
      id TEXT PRIMARY KEY,
      payroll_item_id TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      base_amount INTEGER,
      rate INTEGER,
      amount INTEGER NOT NULL,
      sort_order INTEGER NOT NULL
    )
  `);

  await addColumnIfMissing("payroll_item_lines", "code", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("payroll_item_lines", "base_amount", "INTEGER");
  await addColumnIfMissing("payroll_item_lines", "rate", "INTEGER");
  await addColumnIfMissing("payroll_item_lines", "sort_order", "INTEGER NOT NULL DEFAULT 0");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rules_versions (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL UNIQUE,
      json_blob TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before TEXT,
      after TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payroll_adjustments (
      id TEXT PRIMARY KEY,
      original_payroll_run_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      period TEXT NOT NULL,
      company_id TEXT NOT NULL,
      delta_gross INTEGER NOT NULL,
      delta_net INTEGER NOT NULL,
      delta_employer_cost INTEGER NOT NULL,
      delta_cnss INTEGER NOT NULL,
      delta_amo INTEGER NOT NULL,
      delta_ir INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS declarations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      type TEXT NOT NULL,
      period TEXT NOT NULL,
      payroll_run_id TEXT NOT NULL,
      status TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      exported INTEGER NOT NULL DEFAULT 0,
      totals_json TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS declaration_lines (
      id TEXT PRIMARY KEY,
      declaration_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      matricule TEXT NOT NULL,
      full_name TEXT NOT NULL,
      cnss_number TEXT,
      cin TEXT NOT NULL,
      gross_salary INTEGER NOT NULL,
      cnss_base INTEGER,
      amo_base INTEGER,
      employee_cnss INTEGER,
      employer_cnss INTEGER,
      employee_amo INTEGER,
      employer_amo INTEGER,
      ir INTEGER,
      net_salary INTEGER,
      family_allowance INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rubriques (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      date_debut TEXT NOT NULL,
      date_fin TEXT NOT NULL,
      employee_id TEXT,
      scope TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Migration: add date_debut / date_fin for old tables, then drop legacy period
  await addColumnIfMissing("rubriques", "date_debut", "TEXT");
  await addColumnIfMissing("rubriques", "date_fin", "TEXT");

  const hasPeriod = await columnExists("rubriques", "period");
  if (hasPeriod) {
    await backfillDatesFromPeriod();
    await recreateRubriquesWithoutPeriod();
  }
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string): Promise<void> {
  const db = await getDatabase();
  const columns = await db.select<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) return;

  await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const db = await getDatabase();
  const columns = await db.select<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  return columns.some((c) => c.name === columnName);
}

async function backfillDatesFromPeriod(): Promise<void> {
  const db = await getDatabase();
  const needsBackfill = await db.select<Array<Record<string, unknown>>>(
    "SELECT id FROM rubriques WHERE date_debut IS NULL OR date_fin IS NULL LIMIT 1",
  );
  if (needsBackfill.length === 0) return;

  const rows = await db.select<Array<{ id: string; period: string }>>(
    "SELECT id, period FROM rubriques WHERE date_debut IS NULL OR date_fin IS NULL",
  );
  for (const row of rows) {
    const [y, m] = row.period.split("-");
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    await db.execute("UPDATE rubriques SET date_debut = ?, date_fin = ? WHERE id = ?", [
      `${y}-${m}-01`,
      `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
      row.id,
    ]);
  }
}

async function recreateRubriquesWithoutPeriod(): Promise<void> {
  const db = await getDatabase();
  // Recreate with correct schema (drop period, add NOT NULL on date_debut/date_fin)
  await db.execute(`
    CREATE TABLE rubriques_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      date_debut TEXT NOT NULL,
      date_fin TEXT NOT NULL,
      employee_id TEXT,
      scope TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(`
    INSERT INTO rubriques_new (id, company_id, date_debut, date_fin, employee_id, scope, type, label, amount, created_at)
    SELECT id, company_id, date_debut, date_fin, employee_id, scope, type, label, amount, created_at FROM rubriques
  `);
  await db.execute("DROP TABLE rubriques");
  await db.execute("ALTER TABLE rubriques_new RENAME TO rubriques");
}
