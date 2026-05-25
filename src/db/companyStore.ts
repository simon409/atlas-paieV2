import { asc, eq } from "drizzle-orm";
import { getDrizzleDb, setupDatabase } from "./client.ts";
import type { Company, CompanyDraft } from "./models.ts";
import { companies } from "./schema.ts";

export const DEFAULT_COMPANY_ID = "demo-company";

const ACTIVE_COMPANY_KEY = "atlas-paie.active-company-id";

type CompanyRow = typeof companies.$inferSelect;

export async function ensureDefaultCompany(): Promise<Company> {
  await setupDatabase();
  const existing = await getCompany(DEFAULT_COMPANY_ID);
  if (existing) {
    ensureActiveCompany(existing.id);
    return existing;
  }

  const company: Company = {
    id: DEFAULT_COMPANY_ID,
    name: "Demo Company",
    ice: "",
    cnssAffiliation: "",
    createdAt: new Date(),
  };

  await getDrizzleDb().insert(companies).values(toCompanyRow(company)).run();
  ensureActiveCompany(company.id);
  return company;
}

export async function listCompanies(): Promise<Company[]> {
  await ensureDefaultCompany();
  const rows = await getDrizzleDb().select().from(companies).orderBy(asc(companies.name));
  return rows.map(fromCompanyRow);
}

export async function createCompany(draft: CompanyDraft): Promise<Company> {
  await setupDatabase();
  const company: Company = {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    ice: draft.ice.trim(),
    cnssAffiliation: draft.cnssAffiliation.trim(),
    createdAt: new Date(),
  };

  if (!company.name) throw new Error("Company name is required");
  await getDrizzleDb().insert(companies).values(toCompanyRow(company)).run();
  return company;
}

export async function updateCompany(id: string, patch: Partial<CompanyDraft>): Promise<Company> {
  await ensureDefaultCompany();
  const existing = await getCompany(id);
  if (!existing) throw new Error("Company not found");

  const updated: Company = {
    ...existing,
    ...patch,
    name: patch.name === undefined ? existing.name : patch.name.trim(),
    ice: patch.ice === undefined ? existing.ice : patch.ice.trim(),
    cnssAffiliation:
      patch.cnssAffiliation === undefined ? existing.cnssAffiliation : patch.cnssAffiliation.trim(),
  };

  if (!updated.name) throw new Error("Company name is required");
  await getDrizzleDb().update(companies).set(toCompanyRow(updated)).where(eq(companies.id, id)).run();
  return updated;
}

export async function getActiveCompany(): Promise<Company> {
  const companyId = await getActiveCompanyId();
  const company = await getCompany(companyId);
  if (company) return company;

  const fallback = await ensureDefaultCompany();
  setActiveCompanyId(fallback.id);
  return fallback;
}

export async function getActiveCompanyId(): Promise<string> {
  await ensureDefaultCompany();
  const stored = localStorage.getItem(ACTIVE_COMPANY_KEY);
  if (stored && stored !== "undefined") return stored;

  const all = await listCompanies();
  const first = all[0];
  if (first) {
    setActiveCompanyId(first.id);
    return first.id;
  }
  return DEFAULT_COMPANY_ID;
}

export function setActiveCompanyId(companyId: string): void {
  if (!companyId || companyId === "undefined") return;
  localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
}

async function getCompany(id: string): Promise<Company | null> {
  const row = await getDrizzleDb().select().from(companies).where(eq(companies.id, id)).get();
  return row ? fromCompanyRow(row) : null;
}

function ensureActiveCompany(companyId: string): void {
  const stored = localStorage.getItem(ACTIVE_COMPANY_KEY);
  if (!stored || stored === "undefined") {
    setActiveCompanyId(companyId);
  }
}

function toCompanyRow(company: Company): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    ice: company.ice || null,
    cnssAffiliation: company.cnssAffiliation || null,
    createdAt: company.createdAt,
  };
}

function fromCompanyRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    ice: row.ice ?? "",
    cnssAffiliation: row.cnssAffiliation ?? "",
    createdAt: row.createdAt,
  };
}
