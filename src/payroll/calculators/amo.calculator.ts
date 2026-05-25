import type { Decimal } from "decimal.js";
import type { AMORules } from "../rules/types.ts";
import { normalizeRate } from "../../lib/math.ts";
import { calculateContribution } from "./utils.ts";

export function calculateAMO(grossSalary: Decimal, rules: AMORules) {
  const employeeRate = normalizeRate(
    rules.contributions.find((c) => c.role === "employee")?.rate,
    "amo.employee",
  );
  const employerRate = normalizeRate(
    rules.contributions.find((c) => c.role === "employer")?.rate,
    "amo.employer",
  );

  return {
    base: grossSalary,
    employeeContribution: calculateContribution(grossSalary, employeeRate),
    employerContribution: calculateContribution(grossSalary, employerRate),
    employeeRate,
    employerRate,
  };
}
