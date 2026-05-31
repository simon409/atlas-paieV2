import type { DeclarationLine } from "../../db/models.ts";

export interface ValidationError {
  employeeId: string;
  employeeName: string;
  message: string;
}

export function validateCnssLines(lines: DeclarationLine[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const line of lines) {
    if (!line.cnssNumber || line.cnssNumber.trim() === "") {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "Numéro CNSS manquant",
      });
    }

    if (!line.cin || line.cin.trim() === "") {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "CIN manquante",
      });
    }

    if (line.grossSalary < 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "Salaire brut négatif",
      });
    }

    if (line.cnssBase !== null && line.cnssBase < 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "Base CNSS négative",
      });
    }

    if (line.employeeCnss !== null && line.employeeCnss < 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "Cotisation CNSS employé négative",
      });
    }
  }

  return errors;
}

export function validateIrLines(lines: DeclarationLine[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const line of lines) {
    if (line.ir !== null && line.ir < 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "IR négatif",
      });
    }

    if (line.grossSalary < 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "Salaire brut négatif",
      });
    }
  }

  return errors;
}
