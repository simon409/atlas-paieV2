import Decimal from "decimal.js";
import type { IRBracket, IRRules } from "../rules/types.ts";
import { D, roundIR, roundMoney } from "../../lib/decimal.ts";
import type { CumulativeIRContext } from "../../types/payroll.types.ts";

function findAnnualIRBracket(taxable: Decimal, brackets: IRBracket[]): IRBracket {
  const bracket = brackets.find((candidate) => {
    const max = candidate.max === null ? null : D(candidate.max);
    return taxable.greaterThanOrEqualTo(candidate.min) && (max === null || taxable.lessThanOrEqualTo(max));
  });

  return bracket ?? brackets[0];
}

export function calculateAnnualizedIR(
  monthlyNetTaxable: Decimal,
  dependentsCount: number,
  rules: IRRules,
  context?: CumulativeIRContext,
) {
  const month = normalizeMonth(context?.month ?? 1);
  const previousTaxableIncome = D(context?.previousTaxableIncome ?? 0);
  const previousIRWithheld = D(context?.previousIRWithheld ?? 0);
  const cumulativeTaxableIncome = previousTaxableIncome.plus(monthlyNetTaxable);
  const annualTaxable = cumulativeTaxableIncome.dividedBy(month).mul(12);
  const annualBrackets = rules.brackets.map((bracket) => ({
    ...bracket,
    min: bracket.min * 12,
    max: bracket.max === null ? null : bracket.max * 12,
    deduction: bracket.deduction * 12,
  }));
  const bracket = findAnnualIRBracket(annualTaxable, annualBrackets);
  const annualIR = Decimal.max(
    annualTaxable.mul(bracket.rate).sub(bracket.deduction),
    D(0),
  );
  const dependents = Math.min(dependentsCount, rules.maxDependents);
  const annualFamilyDeductions = D(rules.familyDeductionPerDependent).mul(dependents).mul(12);
  const annualIRNet = Decimal.max(annualIR.sub(annualFamilyDeductions), D(0));
  const cumulativeIRDue = annualIRNet.dividedBy(12).mul(month);
  const currentMonthIR = Decimal.max(cumulativeIRDue.sub(previousIRWithheld), D(0));

  return {
    base: monthlyNetTaxable,
    month,
    cumulativeTaxableIncome: roundMoney(cumulativeTaxableIncome),
    annualTaxable: roundMoney(annualTaxable),
    annualIR: roundMoney(annualIRNet),
    cumulativeIRDue: roundMoney(cumulativeIRDue),
    previousIRWithheld: roundMoney(previousIRWithheld),
    irBrut: roundIR(currentMonthIR),
    familyDeductions: roundMoney(annualFamilyDeductions.dividedBy(12)),
    irNet: roundIR(currentMonthIR),
    bracketRate: D(bracket.rate),
  };
}

function normalizeMonth(month: number): number {
  if (!Number.isFinite(month)) return 1;
  return Math.min(Math.max(Math.trunc(month), 1), 12);
}
