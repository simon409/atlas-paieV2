import type { PayrollState } from "../state.ts";
import type { AMORules } from "../../rules/types.ts";
import { calculateAMO } from "../../calculators/amo.calculator.ts";
import { traceStep } from "../../debug/trace.ts";

export function applyAMO(state: PayrollState, rules: AMORules): PayrollState {
  const amo = calculateAMO(state.grossSalary, rules);

  return traceStep(
    {
      ...state,
      amoBase: amo.base,
      amoEmployee: amo.employeeContribution,
      amoEmployer: amo.employerContribution,
    },
    `AMO: ${amo.employeeContribution.toFixed(2)} (${amo.base.toFixed(2)} x ${(amo.employeeRate * 100).toFixed(2)}%)`,
  );
}
