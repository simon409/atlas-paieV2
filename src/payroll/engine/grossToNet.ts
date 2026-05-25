import type { PayrollRules } from "../rules/types.ts";
import { roundMoney } from "../../lib/decimal.ts";
import type { PayrollInput, PayrollResult } from "../../types/payroll.types.ts";
import { applyAMO } from "./pipeline/amo.ts";
import { applyCNSS } from "./pipeline/cnss.ts";
import { applyEmployerCost } from "./pipeline/employerCost.ts";
import { applyFraisProfessionnels } from "./pipeline/fraisProfessionnels.ts";
import { applyIR } from "./pipeline/ir.ts";
import { initPayrollState, serializePayrollState } from "./state.ts";

export function calculatePayroll(input: PayrollInput, rules: PayrollRules) {
  let state = initPayrollState(input);

  state = {
    ...state,
    grossSalary: roundMoney(
      state.baseSalary.plus(state.allowances).plus(state.bonuses).sub(state.deductions),
    ),
  };

  if (state.grossSalary.lessThan(0)) {
    throw new Error("Gross salary cannot be negative");
  }

  state = applyCNSS(state, rules.cnss);
  state = applyAMO(state, rules.amo);
  state = applyFraisProfessionnels(state, rules.frais_professionnels);

  if (state.netTaxable.lessThan(0)) {
    throw new Error("Net taxable income cannot be negative");
  }

  state = applyIR(state, rules.ir, input.irMode ?? "simplified");
  state = {
    ...state,
    netSalary: roundMoney(state.grossSalary.sub(state.cnssEmployee).sub(state.amoEmployee).sub(state.irNet)),
  };

  if (state.netSalary.lessThan(0)) {
    throw new Error("Net salary cannot be negative");
  }

  state = applyEmployerCost(state);
  return serializePayrollState(state);
}

export type { PayrollInput, PayrollResult };
