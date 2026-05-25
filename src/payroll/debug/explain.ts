import type { PayrollResult } from "../../types/payroll.types.ts";

export function explainPayroll(result: PayrollResult): string[] {
  return [
    `Gross salary is ${result.grossSalary.toFixed(2)} MAD.`,
    `Taxable income was reduced by CNSS (${result.cnssEmployee.toFixed(2)}), AMO (${result.amoEmployee.toFixed(2)}), and professional expenses (${result.fraisProfessionnels.toFixed(2)}).`,
    `Net salary is ${result.netSalary.toFixed(2)} MAD after IR of ${result.irNet.toFixed(2)}.`,
  ];
}
