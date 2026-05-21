import Decimal from 'decimal.js';
import type { CNSSRules, AMORules } from '../rules/types';
import { D, normalizeRate } from '../../lib/utils.ts';

export function calculateCNSS(grossSalary: Decimal, rules: CNSSRules) {
  const gross = new Decimal(grossSalary);
  const cap = new Decimal(rules.ceiling);
  const cappedBase = Decimal.min(gross, cap);

  const employeeRate = D(
    normalizeRate(
      rules.contributions.find(c => c.code === "social_security_employee")?.rate,
      "cnss.employee"
    )
  );
  const employerRate = D(
    normalizeRate(
      rules.contributions.find(c => c.code === 'social_security_employer')?.rate,
      "cnss.employer"
    )
  );

  const employeeContribution = cappedBase.mul(employeeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const employerContribution = cappedBase.mul(employerRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    base: cappedBase.toNumber(),
    employeeContribution: employeeContribution.toNumber(),
    employerContribution: employerContribution.toNumber(),
  };
}

export function calculateAMO(grossSalary: Decimal, rules: AMORules) {
  const gross = new Decimal(grossSalary);

  // AMO is calculated on the uncapped gross salary
  const employeeRate = rules.contributions.find(c => c.role === 'employee')?.rate || 0;
  const employerRate = rules.contributions.find(c => c.role === 'employer')?.rate || 0;

  const employeeContribution = gross.mul(employeeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const employerContribution = gross.mul(employerRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    base: gross.toNumber(),
    employeeContribution: employeeContribution.toNumber(),
    employerContribution: employerContribution.toNumber(),
  };
}
