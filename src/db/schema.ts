import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(), // UUID string
  cin: text("cin").notNull(),
  cnssNumber: text("cnssNumber"),
  fullName: text("fullName").notNull(),
  hireDate: text("hireDate").notNull(), // ISO Date string
  contractType: text("contractType").notNull(), // CDI, CDD, ANAPEC, etc.
  salaryBase: integer("salaryBase").notNull(), // Stored as integer cents
  status: text("status").notNull(), // ACTIVE, INACTIVE
  companyId: text("companyId").notNull(),
});

export const payrollRuns = sqliteTable("payroll_runs", {
  id: text("id").primaryKey(),
  companyId: text("companyId").notNull(),
  period: text("period").notNull(), // YYYY-MM
  ruleVersion: integer("ruleVersion").notNull(), // 2024, 2025, 2026
  status: text("status").notNull(), // DRAFT, LOCKED
  totalGross: integer("totalGross").notNull(), // Stored as integer cents
  totalNet: integer("totalNet").notNull(), // Stored as integer cents
  totalEmployerCost: integer("totalEmployerCost").notNull(), // Stored as integer cents
});

export const payrollItems = sqliteTable("payroll_items", {
  id: text("id").primaryKey(),
  payrollRunId: text("payrollRunId").notNull(),
  employeeId: text("employeeId").notNull(),
  rulesVersion: integer("rulesVersion").notNull(),
  rulesSnapshot: text("rulesSnapshot").notNull(), // JSON string
  inputSnapshot: text("inputSnapshot").notNull(), // JSON string
  calculationHash: text("calculationHash").notNull(), // SHA-256 of stable stringified data
  grossSalary: integer("grossSalary").notNull(), // Stored as integer cents
  netSalary: integer("netSalary").notNull(),
  cnssEmployee: integer("cnssEmployee").notNull(),
  cnssEmployer: integer("cnssEmployer").notNull(),
  ir: integer("ir").notNull(),
  amo: integer("amo").notNull(),
  allowances: integer("allowances").notNull(),
  deductions: integer("deductions").notNull(),
});

export const rulesVersions = sqliteTable("rules_versions", {
  id: text("id").primaryKey(),
  year: integer("year").notNull().unique(),
  jsonBlob: text("jsonBlob").notNull(), // Store as serialized JSON
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(), // e.g., 'EMPLOYEE', 'PAYROLL_RUN'
  entityId: text("entityId").notNull(),
  action: text("action").notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  before: text("before"), // JSON state before
  after: text("after"), // JSON state after
  createdAt: integer("createdAt", { mode: 'timestamp' }).notNull(),
});

export const payrollAdjustments = sqliteTable("payroll_adjustments", {
  id: text("id").primaryKey(),
  originalPayrollRunId: text("originalPayrollRunId").notNull(),
  employeeId: text("employeeId").notNull(),
  period: text("period").notNull(),
  companyId: text("companyId").notNull(),
  deltaGross: integer("deltaGross").notNull(), // Stored as integer cents
  deltaNet: integer("deltaNet").notNull(),
  deltaEmployerCost: integer("deltaEmployerCost").notNull(),
  deltaCnss: integer("deltaCnss").notNull(),
  deltaAmo: integer("deltaAmo").notNull(),
  deltaIr: integer("deltaIr").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).notNull(),
});
