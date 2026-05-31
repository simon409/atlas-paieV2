import type { PayrollState } from "../state.ts";
import { traceStep } from "../../debug/trace.ts";

export function applyEmployerCost(state: PayrollState): PayrollState {
  const employerCost = state.grossSalary.plus(state.cnssEmployer).plus(state.amoEmployer).plus(state.familyAllowance);

  return traceStep(
    {
      ...state,
      employerCost,
    },
    `Employer cost: ${employerCost.toFixed(2)}`,
  );
}
