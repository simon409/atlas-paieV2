import type { PayrollState } from "../state.ts";
import type { FraisProRules } from "../../rules/types.ts";
import { calculateFraisProfessionnels } from "../../calculators/fraisProfessionnels.calculator.ts";
import { traceStep } from "../../debug/trace.ts";

export function applyFraisProfessionnels(state: PayrollState, rules: FraisProRules): PayrollState {
  const fraisProfessionnels = calculateFraisProfessionnels(state.grossSalary, rules);

  return traceStep(
    {
      ...state,
      fraisProfessionnels,
      netTaxable: state.grossSalary
        .sub(state.cnssEmployee)
        .sub(state.amoEmployee)
        .sub(fraisProfessionnels),
    },
    `Frais professionnels: ${fraisProfessionnels.toFixed(2)}`,
  );
}
