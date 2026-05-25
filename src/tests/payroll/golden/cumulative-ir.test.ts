import { calculatePayroll } from "../../../payroll/engine/grossToNet.ts";
import type { PayrollRules } from "../../../payroll/rules/types.ts";
import rules2026 from "../../../payroll/rules/2026.json";
import { assertApprox } from "../../utils/assert.ts";

const rules = rules2026 as PayrollRules;

test("legal simulation IR uses cumulative taxable and already withheld IR", () => {
  const result = calculatePayroll(
    {
      baseSalary: 6500,
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      dependentsCount: 0,
      irMode: "legal_simulation",
      cumulativeIR: {
        month: 3,
        previousTaxableIncome: 9568.6,
        previousIRWithheld: 290.2,
      },
    },
    rules,
  );

  assertApprox(result.netTaxable, 4784.3, "net taxable");
  assertApprox(result.annualization?.cumulativeTaxableIncome ?? 0, 14352.9, "cumulative taxable");
  assertApprox(result.annualization?.annualizedTaxableIncome ?? 0, 57411.6, "annualized taxable");
  assertApprox(result.irNet, 145.1, "current month IR");
});
