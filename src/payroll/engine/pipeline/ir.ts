import type { PayrollState } from "../state.ts";
import type { IRCalculationMode, IRRules } from "../../rules/types.ts";
import { calculateIR } from "../../calculators/ir.calculator.ts";
import { traceStep } from "../../debug/trace.ts";

export function applyIR(
  state: PayrollState,
  rules: IRRules,
  mode: IRCalculationMode = "simplified",
): PayrollState {
  const ir = calculateIR(state.netTaxable, state.dependentsCount, rules, mode, state.cumulativeIR);
  const annualization =
    "annualTaxable" in ir
      ? {
          month: ir.month,
          cumulativeTaxableIncome: ir.cumulativeTaxableIncome,
          annualizedTaxableIncome: ir.annualTaxable,
          annualIR: ir.annualIR,
          cumulativeIRDue: ir.cumulativeIRDue,
          previousIRWithheld: ir.previousIRWithheld,
        }
      : undefined;
  const trace =
    annualization === undefined
      ? `IR: ${ir.irNet.toFixed(2)} (bracket ${(ir.bracketRate.toNumber() * 100).toFixed(0)}%)`
      : `IR cumulative M${annualization.month}: ${ir.irNet.toFixed(2)} (due ${annualization.cumulativeIRDue.toFixed(2)} - paid ${annualization.previousIRWithheld.toFixed(2)})`;

  return traceStep(
    {
      ...state,
      irBrut: ir.irBrut,
      irNet: ir.irNet,
      irBracketRate: ir.bracketRate,
      annualization,
    },
    trace,
  );
}
