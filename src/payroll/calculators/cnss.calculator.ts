import type { Decimal } from "decimal.js";
import type { CNSSRules } from "../rules/types.ts";
import { normalizeRate } from "../../lib/math.ts";
import { calculateContribution, capBase } from "./utils.ts";

export function calculateCNSS(grossSalary: Decimal, rules: CNSSRules) {
  const base = capBase(grossSalary, rules.ceiling);
  const employeeRate = normalizeRate(
    rules.contributions.find((c) => c.code === "social_security_employee")?.rate,
    "cnss.employee",
  );
  const employerRate = normalizeRate(
    rules.contributions.find((c) => c.code === "social_security_employer")?.rate,
    "cnss.employer",
  );

  return {
    base,
    employeeContribution: calculateContribution(base, employeeRate),
    employerContribution: calculateContribution(base, employerRate),
    employeeRate,
    employerRate,
  };
}
