import type { PayrollRules } from "../rules/types.ts";
import { calculateCNSS, calculateAMO } from "./cnss.ts";
import { calculateIR, calculateFraisProfessionnels } from "./ir.ts";
import { D } from "../../lib/utils.ts";
import type { Decimal } from "decimal.js";

interface PayrollInput {
  baseSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  dependentsCount: number;
}

/**
 * INTERNAL STATE MODEL (source of truth during computation)
 */
type PayrollState = {
  baseSalary: Decimal;
  allowances: Decimal;
  bonuses: Decimal;
  deductions: Decimal;

  grossSalary: Decimal;

  cnssEmployee: Decimal;
  cnssEmployer: Decimal;

  amoEmployee: Decimal;
  amoEmployer: Decimal;

  fraisProfessionnels: Decimal;

  netTaxable: Decimal;

  irBrut: Decimal;
  irNet: Decimal;

  netSalary: Decimal;

  employerCost: Decimal;
};


/**
 * MAIN ENGINE
 */
export function calculatePayroll(input: PayrollInput, rules: PayrollRules) {
  // =========================
  // 1. INITIAL STATE
  // =========================
  let state: PayrollState = {
    baseSalary: D(input.baseSalary),
    allowances: D(input.allowances),
    bonuses: D(input.bonuses),
    deductions: D(input.deductions),

    grossSalary: D(0),

    cnssEmployee: D(0),
    cnssEmployer: D(0),

    amoEmployee: D(0),
    amoEmployer: D(0),

    fraisProfessionnels: D(0),

    netTaxable: D (0),

    irBrut: D(0),
    irNet: D(0),

    netSalary: D(0),

    employerCost: D(0),
  };

  // =========================
  // 2. GROSS SALARY (PURE)
  // =========================
  state.grossSalary = state.baseSalary
    .plus(state.allowances)
    .plus(state.bonuses)
    .sub(state.deductions);

  if (state.grossSalary.lessThan(0)) {
    throw new Error("Gross salary cannot be negative");
  }

  // =========================
  // 3. CNSS
  // =========================
  const cnss = calculateCNSS(state.grossSalary, rules.cnss);
  state.cnssEmployee = D(cnss.employeeContribution);
  state.cnssEmployer = D(cnss.employerContribution);

  // =========================
  // 4. AMO
  // =========================
  const amo = calculateAMO(state.grossSalary, rules.amo);
  state.amoEmployee = D(amo.employeeContribution);
  state.amoEmployer = D(amo.employerContribution);

  console.log("GROSS:", state.grossSalary);
  console.log("CNSS RULES:", rules.cnss);

  // =========================
  // 5. FRAIS PROFESSIONNELS
  // =========================
  state.fraisProfessionnels = D(
    calculateFraisProfessionnels(
      state.grossSalary,
      rules.frais_professionnels
    )
  );

  // =========================
  // 6. NET TAXABLE (SNI)
  // =========================
  state.netTaxable = state.grossSalary
    .sub(state.cnssEmployee)
    .sub(state.amoEmployee)
    .sub(state.fraisProfessionnels);

  if (state.netTaxable.lessThan(0)) {
    throw new Error("Net taxable income cannot be negative");
  }

  // =========================
  // 7. IR
  // =========================
  const ir = calculateIR(
    state.netTaxable.toNumber(),
    input.dependentsCount,
    rules.ir
  );

  state.irBrut = D(ir.irBrut);
  state.irNet = D(ir.irNet);

  // =========================
  // 8. NET SALARY
  // =========================
  state.netSalary = state.grossSalary
    .sub(state.cnssEmployee)
    .sub(state.amoEmployee)
    .sub(state.irNet);

  if (state.netSalary.lessThan(0)) {
    throw new Error("Net salary cannot be negative");
  }

  // =========================
  // 9. EMPLOYER COST
  // =========================
  state.employerCost = state.grossSalary
    .plus(state.cnssEmployer)
    .plus(state.amoEmployer);

  // =========================
  // 10. FINAL OUTPUT (SAFE SERIALIZATION)
  // =========================
  return {
    grossSalary: state.grossSalary.toNumber(),

    cnssEmployee: state.cnssEmployee.toNumber(),
    cnssEmployer: state.cnssEmployer.toNumber(),

    amoEmployee: state.amoEmployee.toNumber(),
    amoEmployer: state.amoEmployer.toNumber(),

    fraisProfessionnels: state.fraisProfessionnels.toNumber(),

    netTaxable: state.netTaxable.toNumber(),

    irBrut: state.irBrut.toNumber(),
    irNet: state.irNet.toNumber(),

    netSalary: state.netSalary.toNumber(),

    employerCost: state.employerCost.toNumber(),

    breakdown: {
      baseSalary: state.baseSalary.toNumber(),
      allowances: state.allowances.toNumber(),
      bonuses: state.bonuses.toNumber(),
      deductions: state.deductions.toNumber(),
    },
  };
}