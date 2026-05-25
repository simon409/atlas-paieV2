import rules2026 from "./2026.json";
import type { PayrollRules } from "./types.ts";

export const ruleRegistry: Record<number, PayrollRules> = {
  2026: rules2026 as PayrollRules,
};

export function getRegisteredRules(year: number): PayrollRules | undefined {
  return ruleRegistry[year];
}
