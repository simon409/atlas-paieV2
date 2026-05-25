import Decimal from "decimal.js";
import { D, roundMoney } from "../../lib/decimal.ts";

export function capBase(value: Decimal, ceiling: number): Decimal {
  return Decimal.min(value, D(ceiling));
}

export function calculateContribution(base: Decimal, rate: number): Decimal {
  return roundMoney(base.mul(rate));
}
