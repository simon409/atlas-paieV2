import type { PayrollRules } from "../rules/types.ts";
import { validateCNSSRules } from "./cnss.validator.ts";
import { validateIRRules } from "./ir.validator.ts";

export function validateRules(rules: PayrollRules): void {
  if (!rules.cnss) throw new Error("CNSS missing in rules");
  if (!rules.amo) throw new Error("AMO missing in rules");
  if (!rules.ir) throw new Error("IR missing in rules");

  validateCNSSRules(rules.cnss);
  validateIRRules(rules.ir);

  for (const contribution of rules.amo.contributions) {
    if (contribution.rate < 0 || contribution.rate > 1) {
      throw new Error(`AMO rate must be between 0 and 1: ${contribution.code}`);
    }
  }
}
