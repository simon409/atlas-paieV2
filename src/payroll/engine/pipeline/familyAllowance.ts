import type { PayrollState } from "../state.ts";
import type { FamilyAllowanceRules } from "../../rules/types.ts";
import { D, roundMoney } from "../../../lib/decimal.ts";
import { traceStep } from "../../debug/trace.ts";

export function applyFamilyAllowance(state: PayrollState, rules: FamilyAllowanceRules): PayrollState {
  const children = Math.min(state.childrenCount, rules.maxChildren);
  let total = D(0);
  let remaining = children;
  for (const tier of rules.tiers) {
    const take = Math.min(remaining, tier.count);
    total = total.plus(D(tier.amount).mul(take));
    remaining -= take;
    if (remaining <= 0) break;
  }
  const familyAllowance = roundMoney(total);

  return traceStep(
    {
      ...state,
      familyAllowance,
    },
    `Allocations familiales: ${familyAllowance.toFixed(2)} (${children} enfants)`,
  );
}
