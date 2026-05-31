import { calculatePayroll } from "../../../payroll/engine/grossToNet.ts";
import type { PayrollRules } from "../../../payroll/rules/types.ts";
import rules2026 from "../../../payroll/rules/2026.json";

test("throws when gross salary is negative", () => {
  expect(() =>
    calculatePayroll(
      {
        baseSalary: 0,
        allowances: 0,
        bonuses: 0,
        deductions: 1,
        dependentsCount: 0,
        childrenCount: 0,
      },
      rules2026 as PayrollRules,
    ),
  ).toThrow("Gross salary cannot be negative");
});
