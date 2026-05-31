import { generateIrDeclaration, getDeclarationLines } from "../../db/declarationStore.ts";
import type { Declaration, DeclarationLine } from "../../db/models.ts";
import { generateCsv } from "../exports/csvExport.ts";

export async function generateMonthlyIrDeclaration(payrollRunId: string): Promise<Declaration> {
  return await generateIrDeclaration(payrollRunId);
}

export async function generateAnnualIrDeclaration(
  payrollRunIds: string[],
): Promise<{ lines: DeclarationLine[]; totals: { totalGross: number; totalIr: number; employeeCount: number } }> {
  const allLines: DeclarationLine[] = [];

  for (const runId of payrollRunIds) {
    const decl = await generateIrDeclaration(runId);
    const lines = await getDeclarationLines(decl.id);
    allLines.push(...lines);
  }

  const totals = {
    totalGross: allLines.reduce((s, l) => s + l.grossSalary, 0),
    totalIr: allLines.reduce((s, l) => s + (l.ir ?? 0), 0),
    employeeCount: allLines.length,
  };

  return { lines: allLines, totals };
}

export function exportIrCsv(lines: DeclarationLine[]): string {
  return generateCsv(lines);
}
