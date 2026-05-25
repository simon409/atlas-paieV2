import { calculatePayroll, loadRules } from "./src/payroll/index.ts";

const rules = loadRules(2026);

const input = {
  baseSalary: 4000,
  allowances: 0,
  bonuses: 0,
  deductions: 0,
  dependentsCount: 0
};

const result = calculatePayroll(input, rules);

console.log(JSON.stringify(result, null, 2));
