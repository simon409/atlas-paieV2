import type { ValidationError } from "../cnss/cnssValidation.ts";
import type { DeclarationLine } from "../../db/models.ts";

export function validateIrDeclaration(lines: DeclarationLine[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const line of lines) {
    if (line.ir !== null && line.ir < 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "IR négatif détecté",
      });
    }

    if (line.grossSalary <= 0) {
      errors.push({
        employeeId: line.employeeId,
        employeeName: line.fullName,
        message: "Salaire brut invalide",
      });
    }
  }

  return errors;
}
