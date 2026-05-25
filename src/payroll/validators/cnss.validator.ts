import type { CNSSRules } from "../rules/types.ts";

export function validateCNSSRules(rules: CNSSRules): void {
  if (typeof rules.ceiling !== "number" || rules.ceiling <= 0) {
    throw new Error("CNSS ceiling must be a positive number");
  }

  if (!Array.isArray(rules.contributions) || rules.contributions.length === 0) {
    throw new Error("CNSS contributions must be a non-empty array");
  }

  for (const contribution of rules.contributions) {
    if (contribution.rate < 0 || contribution.rate > 1) {
      throw new Error(`CNSS rate must be between 0 and 1: ${contribution.code}`);
    }
  }
}
