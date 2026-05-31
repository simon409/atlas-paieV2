import { calculatePayroll, loadRules } from "../payroll/index.ts";

const rules = loadRules(2026);
const result = calculatePayroll(
  {
    baseSalary: 4000,
    allowances: 0,
    bonuses: 0,
    deductions: 0,
    dependentsCount: 0,
    childrenCount: 0,
  },
  rules,
);

console.log(JSON.stringify(result, null, 2));
