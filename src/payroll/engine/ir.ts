import Decimal from 'decimal.js';
import type { IRRules, FraisProRules } from '../rules/types';

export function calculateFraisProfessionnels(grossTaxable: Decimal, rules: FraisProRules) {
  const taxable = new Decimal(grossTaxable);
  
  if (rules.method === 'percentage_with_cap') {
    const rate = new Decimal(rules.rate || 0);
    // Convert annual cap to monthly ceiling
    const ceiling = new Decimal(rules.annual_cap || 0).dividedBy(12);
  
    const computedFrais = taxable.mul(rate);
    const actualFrais = Decimal.min(computedFrais, ceiling).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  
    return actualFrais.toNumber();
  }
  
  // Fallback if not matching the simple progressive model
  return 0;
}

export function calculateIR(
  netTaxable: number, // Net Taxable Income (SNI) = Gross Taxable - Deductions (CNSS, AMO, Frais Pro)
  dependentsCount: number,
  rules: IRRules
) {
  const sni = new Decimal(netTaxable);
  
  // Find applicable bracket
  let applicableBracket = rules.brackets[0];
  for (const bracket of rules.brackets) {
    if (sni.greaterThanOrEqualTo(bracket.min) && (bracket.max === null || sni.lessThanOrEqualTo(bracket.max))) {
      applicableBracket = bracket;
      break;
    }
  }

  // IR brut = (SNI * rate) - deduction
  const rate = new Decimal(applicableBracket.rate);
  const deductionAmount = new Decimal(applicableBracket.deduction);
  let irBrut = sni.mul(rate).sub(deductionAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (irBrut.lessThan(0)) irBrut = new Decimal(0);

  // Apply family deductions
  const dependents = Math.min(dependentsCount, rules.maxDependents);
  const familyDeduction = new Decimal(rules.familyDeductionPerDependent).mul(dependents);

  let irNet = irBrut.sub(familyDeduction);
  if (irNet.lessThan(0)) irNet = new Decimal(0);

  return {
    base: sni.toNumber(),
    irBrut: irBrut.toNumber(),
    familyDeductions: familyDeduction.toNumber(),
    irNet: irNet.toNumber(),
    bracketRate: applicableBracket.rate
  };
}
