import type { DeclarationLine } from "../../db/models.ts";
import type { DamancomRecord } from "./cnssTypes.ts";

export function toDamancomRecord(line: DeclarationLine): DamancomRecord {
  return {
    cnssNumber: line.cnssNumber ?? "",
    fullName: line.fullName,
    cin: line.cin,
    grossSalary: line.grossSalary,
    cnssBase: line.cnssBase ?? 0,
    employeeCnss: line.employeeCnss ?? 0,
    employerCnss: line.employerCnss ?? 0,
  };
}

export function formatCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
