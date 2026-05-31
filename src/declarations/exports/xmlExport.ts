import type { Declaration, DeclarationLine } from "../../db/models.ts";

export function generateDeclarationXml(declaration: Declaration, lines: DeclarationLine[]): string {
  const linesXml = lines
    .map(
      (line) => `    <declarationLine>
      <matricule>${escapeXml(line.matricule)}</matricule>
      <fullName>${escapeXml(line.fullName)}</fullName>
      <cin>${escapeXml(line.cin)}</cin>
      <cnssNumber>${escapeXml(line.cnssNumber ?? "")}</cnssNumber>
      <grossSalary>${line.grossSalary.toFixed(2)}</grossSalary>
      <cnssBase>${formatNullable(line.cnssBase)}</cnssBase>
      <amoBase>${formatNullable(line.amoBase)}</amoBase>
      <employeeCnss>${formatNullable(line.employeeCnss)}</employeeCnss>
      <employerCnss>${formatNullable(line.employerCnss)}</employerCnss>
      <employeeAmo>${formatNullable(line.employeeAmo)}</employeeAmo>
      <employerAmo>${formatNullable(line.employerAmo)}</employerAmo>
      <ir>${formatNullable(line.ir)}</ir>
      <netSalary>${formatNullable(line.netSalary)}</netSalary>
    </declarationLine>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<declaration>
  <type>${escapeXml(declaration.type)}</type>
  <period>${escapeXml(declaration.period)}</period>
  <generatedAt>${declaration.generatedAt.toISOString()}</generatedAt>
  <status>${escapeXml(declaration.status)}</status>
  <lines>
${linesXml}
  </lines>
</declaration>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNullable(value: number | null): string {
  return value === null ? "" : value.toFixed(2);
}
