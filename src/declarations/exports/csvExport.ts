import type { DeclarationLine } from "../../db/models.ts";

export function generateCsv(lines: DeclarationLine[], delimiter: string = ";"): string {
  const header = [
    "Matricule",
    "Nom complet",
    "CIN",
    "N° CNSS",
    "Salaire brut",
    "Base CNSS",
    "Base AMO",
    "CNSS employé",
    "CNSS employeur",
    "AMO employé",
    "AMO employeur",
    "IR",
    "Salaire net",
    "Allocations familiales",
  ].join(delimiter);

  const rows = lines.map((line) =>
    [
      line.matricule,
      line.fullName,
      line.cin,
      line.cnssNumber ?? "",
      formatDecimal(line.grossSalary),
      formatNullableDecimal(line.cnssBase),
      formatNullableDecimal(line.amoBase),
      formatNullableDecimal(line.employeeCnss),
      formatNullableDecimal(line.employerCnss),
      formatNullableDecimal(line.employeeAmo),
      formatNullableDecimal(line.employerAmo),
      formatNullableDecimal(line.ir),
      formatNullableDecimal(line.netSalary),
      formatNullableDecimal(line.familyAllowance),
    ].join(delimiter),
  );

  return [header, ...rows].join("\r\n");
}

function formatDecimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function formatNullableDecimal(value: number | null): string {
  return value === null ? "" : formatDecimal(value);
}
