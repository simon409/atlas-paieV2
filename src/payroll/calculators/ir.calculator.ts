import Decimal from "decimal.js";
import type { IRCalculationMode, IRBracket, IRRules } from "../rules/types.ts";
import { D, roundIR, roundMoney } from "../../lib/decimal.ts";
import { calculateAnnualizedIR } from "../ir/annualizer.ts";
import type { CumulativeIRContext } from "../../types/payroll.types.ts";

export function findIRBracket(taxable: Decimal, brackets: IRBracket[]): IRBracket {
  const bracket = brackets.find((candidate) => {
    const max = candidate.max === null ? null : D(candidate.max);
    return taxable.greaterThanOrEqualTo(candidate.min) && (max === null || taxable.lessThanOrEqualTo(max));
  });

  return bracket ?? brackets[0];
}

export function calculateIR(
  monthlyNetTaxable: Decimal,
  dependentsCount: number,
  rules: IRRules,
  mode: IRCalculationMode = "simplified",
  cumulativeContext?: CumulativeIRContext,
) {
  if (mode === "legal_simulation") {
    return calculateAnnualizedIR(monthlyNetTaxable, dependentsCount, rules, cumulativeContext);
  }

  const bracket = findIRBracket(monthlyNetTaxable, rules.brackets);
  const irBrut = Decimal.max(
    monthlyNetTaxable.mul(bracket.rate).sub(bracket.deduction),
    D(0),
  );
  const dependents = Math.min(dependentsCount, rules.maxDependents);
  const familyDeductions = D(rules.familyDeductionPerDependent).mul(dependents);
  const irNet = Decimal.max(irBrut.sub(familyDeductions), D(0));

  return {
    base: monthlyNetTaxable,
    irBrut: roundIR(irBrut),
    familyDeductions: roundMoney(familyDeductions),
    irNet: roundIR(irNet),
    bracketRate: D(bracket.rate),
  };
}
