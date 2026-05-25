import { Decimal } from "decimal.js";

export const ROUNDING_DECIMALS = 2;
export const ROUNDING_MODE = Decimal.ROUND_HALF_UP;

export function D(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value);
}

export function roundMoney(value: Decimal.Value): Decimal {
  return D(value).toDecimalPlaces(ROUNDING_DECIMALS, ROUNDING_MODE);
}

/** Round IR up to the nearest whole number (no decimals). */
export function roundIR(value: Decimal.Value): Decimal {
  return D(value).toDecimalPlaces(0, Decimal.ROUND_UP);
}

export function toMoneyNumber(value: Decimal.Value): number {
  return roundMoney(value).toNumber();
}
