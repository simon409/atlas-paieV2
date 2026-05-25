import type { IRRules } from "../rules/types.ts";

export function validateIRRules(rules: IRRules): void {
  if (!Array.isArray(rules.brackets) || rules.brackets.length === 0) {
    throw new Error("IR brackets must be a non-empty array");
  }

  for (const bracket of rules.brackets) {
    if (bracket.rate < 0 || bracket.rate > 1) {
      throw new Error(`IR rate must be between 0 and 1 for min ${bracket.min}`);
    }
    if (bracket.max !== null && bracket.max < bracket.min) {
      throw new Error(`IR bracket max must be greater than min ${bracket.min}`);
    }
  }
}
