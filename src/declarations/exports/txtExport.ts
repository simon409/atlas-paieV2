import type { DamancomRecord } from "../cnss/cnssTypes.ts";

const LINE_LENGTH = 160;

function padRight(value: string | number, length: number): string {
  return String(value).padEnd(length, " ");
}

function padLeft(value: string | number, length: number): string {
  return String(value).padStart(length, " ");
}

export function generateDamancomTxt(records: DamancomRecord[], period: string, companyName: string): string {
  const lines: string[] = [];

  // Header
  const header = `DAMANCOM${padRight(period, 12)}${padRight(companyName, 40)}${padRight("", LINE_LENGTH - 52)}`;
  lines.push(header.substring(0, LINE_LENGTH));

  // Data rows
  for (const record of records) {
    const row = buildRow(record);
    lines.push(row);
  }

  // Footer with totals
  const totalGross = records.reduce((s, r) => s + r.grossSalary, 0);
  const totalCnssBase = records.reduce((s, r) => s + r.cnssBase, 0);
  const totalEmployeeCnss = records.reduce((s, r) => s + r.employeeCnss, 0);
  const totalEmployerCnss = records.reduce((s, r) => s + r.employerCnss, 0);
  const footer = `TOTAL${padRight(records.length.toString(), 8)}${padLeft(totalGross.toFixed(2), 12)}${padLeft(totalCnssBase.toFixed(2), 12)}${padLeft(totalEmployeeCnss.toFixed(2), 12)}${padLeft(totalEmployerCnss.toFixed(2), 12)}`;
  lines.push(footer.substring(0, LINE_LENGTH));

  return lines.join("\r\n");
}

function buildRow(record: DamancomRecord): string {
  const cnssNumber = padRight(record.cnssNumber, 15);
  const fullName = padRight(record.fullName.substring(0, 30), 30);
  const cin = padRight(record.cin, 10);
  const grossSalary = padLeft(record.grossSalary.toFixed(2), 12);
  const cnssBase = padLeft(record.cnssBase.toFixed(2), 12);
  const employeeCnss = padLeft(record.employeeCnss.toFixed(2), 12);
  const employerCnss = padLeft(record.employerCnss.toFixed(2), 12);

  return `${cnssNumber}${fullName}${cin}${grossSalary}${cnssBase}${employeeCnss}${employerCnss}`.substring(0, LINE_LENGTH);
}
