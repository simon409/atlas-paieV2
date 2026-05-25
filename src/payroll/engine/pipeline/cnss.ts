import type { PayrollState } from "../state.ts";
import type { CNSSRules } from "../../rules/types.ts";
import { calculateCNSS } from "../../calculators/cnss.calculator.ts";
import { traceStep } from "../../debug/trace.ts";

export function applyCNSS(state: PayrollState, rules: CNSSRules): PayrollState {
  const cnss = calculateCNSS(state.grossSalary, rules);

  return traceStep(
    {
      ...state,
      cnssBase: cnss.base,
      cnssEmployee: cnss.employeeContribution,
      cnssEmployer: cnss.employerContribution,
    },
    `CNSS: ${cnss.employeeContribution.toFixed(2)} (${cnss.base.toFixed(2)} x ${(cnss.employeeRate * 100).toFixed(2)}%)`,
  );
}
