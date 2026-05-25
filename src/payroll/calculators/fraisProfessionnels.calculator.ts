import Decimal from "decimal.js";
import type { FraisProRules } from "../rules/types.ts";
import { D, roundMoney } from "../../lib/decimal.ts";

export function calculateFraisProfessionnels(grossTaxable: Decimal, rules: FraisProRules): Decimal {
  if (rules.method !== "percentage_with_cap") return D(0);

  const rate = D(rules.rate ?? 0);
  const monthlyCeiling = D(rules.annual_cap ?? 0).dividedBy(12);
  return roundMoney(Decimal.min(grossTaxable.mul(rate), monthlyCeiling));
}
