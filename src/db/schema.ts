import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ice: text("ice"),
  cnssAffiliation: text("cnss_affiliation"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const appUsers = sqliteTable("app_users", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // ADMIN, MANAGER, VIEWER
  status: text("status").notNull(), // ACTIVE, DISABLED
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(), // UUID string
  matricule: text("matricule").notNull().unique(), // Unique employee number
  cin: text("cin").notNull(),
  cnssNumber: text("cnss_number"),
  fullName: text("full_name").notNull(),
  hireDate: text("hire_date").notNull(), // ISO Date string
  seniorityDate: text("seniority_date"),
  birthDate: text("birth_date"),
  familyStatus: text("family_status"),
  childrenCount: integer("children_count"),
  deductionCount: integer("deduction_count"),
  functionTitle: text("function_title"),
  department: text("department"),
  contractType: text("contract_type").notNull(), // CDI, CDD, ANAPEC, etc.
  salaryBase: integer("salary_base").notNull(), // Stored as integer cents
  status: text("status").notNull(), // ACTIVE, INACTIVE
  companyId: text("company_id").notNull(),
});

export const payrollRuns = sqliteTable("payroll_runs", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  period: text("period").notNull(), // YYYY-MM
  ruleVersion: integer("rule_version").notNull(), // 2024, 2025, 2026
  status: text("status").notNull(), // DRAFT, LOCKED
  totalGross: integer("total_gross").notNull(), // Stored as integer cents
  totalNet: integer("total_net").notNull(), // Stored as integer cents
  totalEmployerCost: integer("total_employer_cost").notNull(), // Stored as integer cents
});

export const payrollItems = sqliteTable("payroll_items", {
  id: text("id").primaryKey(),
  payrollRunId: text("payroll_run_id").notNull(),
  employeeId: text("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  employeeMatricule: text("employee_matricule").notNull(),
  rulesVersion: integer("rules_version").notNull(),
  rulesSnapshot: text("rules_snapshot").notNull(), // JSON string
  inputSnapshot: text("input_snapshot").notNull(), // JSON string
  calculationHash: text("calculation_hash").notNull(), // SHA-256 of stable stringified data
  grossSalary: integer("gross_salary").notNull(), // Stored as integer cents
  netSalary: integer("net_salary").notNull(),
  cnssEmployee: integer("cnss_employee").notNull(),
  cnssEmployer: integer("cnss_employer").notNull(),
  ir: integer("ir").notNull(),
  amo: integer("amo").notNull(),
  allowances: integer("allowances").notNull(),
  bonuses: integer("bonuses").notNull(),
  deductions: integer("deductions").notNull(),
  taxableIncome: integer("taxable_income").notNull(),
  professionalExpenses: integer("professional_expenses").notNull(),
  cumulativeTaxableIncome: integer("cumulative_taxable_income"),
  previousIrWithheld: integer("previous_ir_withheld"),
  cumulativeIrDue: integer("cumulative_ir_due"),
  roundingCarryForward: integer("rounding_carry_forward").notNull().default(0),
  roundingDiff: integer("rounding_diff").notNull().default(0),
  traceJson: text("trace_json").notNull(),
});

export const payrollItemLines = sqliteTable("payroll_item_lines", {
  id: text("id").primaryKey(),
  payrollItemId: text("payroll_item_id").notNull(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(), // ALLOWANCE, BONUS, DEDUCTION
  baseAmount: integer("base_amount"),
  rate: integer("rate"),
  amount: integer("amount").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const rulesVersions = sqliteTable("rules_versions", {
  id: text("id").primaryKey(),
  year: integer("year").notNull().unique(),
  jsonBlob: text("json_blob").notNull(), // Store as serialized JSON
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(), // e.g., 'EMPLOYEE', 'PAYROLL_RUN'
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  before: text("before"), // JSON state before
  after: text("after"), // JSON state after
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const payrollAdjustments = sqliteTable("payroll_adjustments", {
  id: text("id").primaryKey(),
  originalPayrollRunId: text("original_payroll_run_id").notNull(),
  employeeId: text("employee_id").notNull(),
  period: text("period").notNull(),
  companyId: text("company_id").notNull(),
  deltaGross: integer("delta_gross").notNull(), // Stored as integer cents
  deltaNet: integer("delta_net").notNull(),
  deltaEmployerCost: integer("delta_employer_cost").notNull(),
  deltaCnss: integer("delta_cnss").notNull(),
  deltaAmo: integer("delta_amo").notNull(),
  deltaIr: integer("delta_ir").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const rubriques = sqliteTable("rubriques", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  dateDebut: text("date_debut").notNull(),
  dateFin: text("date_fin").notNull(),
  employeeId: text("employee_id"),
  scope: text("scope").notNull(), // employee, group, all
  type: text("type").notNull(), // BONUS, TAXABLE_ALLOWANCE, NON_TAXABLE_ALLOWANCE, DEDUCTION
  label: text("label").notNull(),
  amount: integer("amount").notNull(), // Stored as integer cents
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
