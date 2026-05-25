import { and, asc, eq, lte, gte, or } from "drizzle-orm";
import type { PayrollMovement, PayrollMovementDraft } from "./models.ts";
import { getDrizzleDb, setupDatabase } from "./client.ts";
import { rubriques } from "./schema.ts";
import { getActiveCompanyId } from "./companyStore.ts";

type RubriqueRow = typeof rubriques.$inferSelect;

export async function listMovements(dateDebut: string, dateFin: string): Promise<PayrollMovement[]> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const rows = await getDrizzleDb()
    .select()
    .from(rubriques)
    .where(
      and(
        eq(rubriques.companyId, companyId),
        lte(rubriques.dateDebut, dateFin),
        gte(rubriques.dateFin, dateDebut),
      ),
    )
    .orderBy(asc(rubriques.createdAt));

  return rows.map(fromRubriqueRow);
}

export async function createMovement(draft: PayrollMovementDraft): Promise<PayrollMovement> {
  await setupDatabase();
  const movement: PayrollMovement = {
    id: crypto.randomUUID(),
    companyId: await getActiveCompanyId(),
    createdAt: new Date(),
    ...normalizeDraft(draft),
  };

  await getDrizzleDb().insert(rubriques).values(toRubriqueRow(movement)).run();
  return movement;
}

export async function updateMovement(
  id: string,
  patch: Partial<PayrollMovementDraft>,
): Promise<PayrollMovement> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const existing = await getDrizzleDb()
    .select()
    .from(rubriques)
    .where(and(eq(rubriques.id, id), eq(rubriques.companyId, companyId)))
    .get();

  if (!existing) throw new Error("Movement not found");
  const current = fromRubriqueRow(existing);

  const updated: PayrollMovement = {
    ...current,
    ...patch,
    amount: patch.amount === undefined ? current.amount : normalizeAmount(patch.amount),
    label: patch.label === undefined ? current.label : patch.label.trim(),
  };

  await getDrizzleDb().update(rubriques).set(toRubriqueRow(updated)).where(eq(rubriques.id, id)).run();
  return updated;
}

export async function deleteMovement(id: string): Promise<void> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  await getDrizzleDb()
    .delete(rubriques)
    .where(and(eq(rubriques.id, id), eq(rubriques.companyId, companyId)))
    .run();
}

export async function getMovementTotals(dateDebut: string, dateFin: string, employeeId: string): Promise<{
  allowances: number;
  bonuses: number;
  deductions: number;
  labels: {
    allowances: string[];
    bonuses: string[];
    deductions: string[];
  };
}> {
  await setupDatabase();
  const companyId = await getActiveCompanyId();
  const rows = await getDrizzleDb()
    .select()
    .from(rubriques)
    .where(
      and(
        eq(rubriques.companyId, companyId),
        lte(rubriques.dateDebut, dateFin),
        gte(rubriques.dateFin, dateDebut),
        or(eq(rubriques.scope, "all"), and(eq(rubriques.scope, "employee"), eq(rubriques.employeeId, employeeId))),
      ),
    )
    .orderBy(asc(rubriques.createdAt));

  return rows.reduce(
    (acc, row) => {
      const movement = fromRubriqueRow(row);
      if (movement.type === "BONUS") {
        acc.bonuses += movement.amount;
        if (movement.label) acc.labels.bonuses.push(movement.label);
      } else if (movement.type === "TAXABLE_ALLOWANCE" || movement.type === "NON_TAXABLE_ALLOWANCE") {
        acc.allowances += movement.amount;
        if (movement.label) acc.labels.allowances.push(movement.label);
      } else if (movement.type === "DEDUCTION") {
        acc.deductions += movement.amount;
        if (movement.label) acc.labels.deductions.push(movement.label);
      }

      return acc;
    },
    {
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      labels: {
        allowances: [] as string[],
        bonuses: [] as string[],
        deductions: [] as string[],
      },
    },
  );
}

function toRubriqueRow(movement: PayrollMovement): RubriqueRow {
  return {
    id: movement.id,
    companyId: movement.companyId,
    dateDebut: movement.dateDebut,
    dateFin: movement.dateFin,
    employeeId: movement.employeeId,
    scope: movement.scope,
    type: movement.type,
    label: movement.label,
    amount: moneyToCents(movement.amount),
    createdAt: movement.createdAt,
  };
}

function fromRubriqueRow(row: RubriqueRow): PayrollMovement {
  return {
    id: row.id,
    companyId: row.companyId,
    dateDebut: row.dateDebut ?? "",
    dateFin: row.dateFin ?? "",
    employeeId: row.employeeId,
    scope: row.scope as PayrollMovement["scope"],
    type: row.type as PayrollMovement["type"],
    label: row.label,
    amount: centsToMoney(row.amount),
    createdAt: row.createdAt,
  };
}

function normalizeDraft(draft: PayrollMovementDraft): PayrollMovementDraft {
  return {
    ...draft,
    label: draft.label.trim(),
    amount: normalizeAmount(draft.amount),
    employeeId: draft.scope === "employee" ? draft.employeeId : null,
  };
}

function normalizeAmount(value: number): number {
  return Math.max(0, value);
}

function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

function centsToMoney(value: number): number {
  return value / 100;
}
