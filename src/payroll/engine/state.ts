import type { Decimal } from "decimal.js";
import { D, toMoneyNumber } from "../../lib/decimal.ts";
import type { CumulativeIRContext, PayrollInput, PayrollResult } from "../../types/payroll.types.ts";

export type PayrollState = {
  baseSalary: Decimal;
  allowances: Decimal;
  bonuses: Decimal;
  deductions: Decimal;
  dependentsCount: number;
  cumulativeIR?: CumulativeIRContext;
  grossSalary: Decimal;
  cnssBase: Decimal;
  cnssEmployee: Decimal;
  cnssEmployer: Decimal;
  amoBase: Decimal;
  amoEmployee: Decimal;
  amoEmployer: Decimal;
  fraisProfessionnels: Decimal;
  netTaxable: Decimal;
  irBrut: Decimal;
  irNet: Decimal;
  irBracketRate: Decimal;
  annualization?: {
    month: number;
    cumulativeTaxableIncome: Decimal;
    annualizedTaxableIncome: Decimal;
    annualIR: Decimal;
    cumulativeIRDue: Decimal;
    previousIRWithheld: Decimal;
  };
  netSalary: Decimal;
  employerCost: Decimal;
  trace: string[];
};

export function initPayrollState(input: PayrollInput): PayrollState {
  return {
    baseSalary: D(input.baseSalary),
    allowances: D(input.allowances),
    bonuses: D(input.bonuses),
    deductions: D(input.deductions),
    dependentsCount: input.dependentsCount,
    cumulativeIR: input.cumulativeIR,
    grossSalary: D(0),
    cnssBase: D(0),
    cnssEmployee: D(0),
    cnssEmployer: D(0),
    amoBase: D(0),
    amoEmployee: D(0),
    amoEmployer: D(0),
    fraisProfessionnels: D(0),
    netTaxable: D(0),
    irBrut: D(0),
    irNet: D(0),
    irBracketRate: D(0),
    netSalary: D(0),
    employerCost: D(0),
    trace: [],
  };
}

export function serializePayrollState(state: PayrollState): PayrollResult {
  return {
    grossSalary: toMoneyNumber(state.grossSalary),
    cnssEmployee: toMoneyNumber(state.cnssEmployee),
    cnssEmployer: toMoneyNumber(state.cnssEmployer),
    amoEmployee: toMoneyNumber(state.amoEmployee),
    amoEmployer: toMoneyNumber(state.amoEmployer),
    fraisProfessionnels: toMoneyNumber(state.fraisProfessionnels),
    netTaxable: toMoneyNumber(state.netTaxable),
    irBrut: toMoneyNumber(state.irBrut),
    irNet: toMoneyNumber(state.irNet),
    netSalary: toMoneyNumber(state.netSalary),
    employerCost: toMoneyNumber(state.employerCost),
    breakdown: {
      baseSalary: toMoneyNumber(state.baseSalary),
      allowances: toMoneyNumber(state.allowances),
      bonuses: toMoneyNumber(state.bonuses),
      deductions: toMoneyNumber(state.deductions),
    },
    trace: state.trace,
    annualization: state.annualization
      ? {
          month: state.annualization.month,
          cumulativeTaxableIncome: toMoneyNumber(state.annualization.cumulativeTaxableIncome),
          annualizedTaxableIncome: toMoneyNumber(state.annualization.annualizedTaxableIncome),
          annualIR: toMoneyNumber(state.annualization.annualIR),
          cumulativeIRDue: toMoneyNumber(state.annualization.cumulativeIRDue),
          previousIRWithheld: toMoneyNumber(state.annualization.previousIRWithheld),
        }
      : undefined,
  };
}
