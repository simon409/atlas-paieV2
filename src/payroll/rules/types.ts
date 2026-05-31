export type PayrollStep = "cnss" | "amo" | "frais_professionnels" | "ir" | "family_allowance" | "net";
export type IRCalculationMode = "simplified" | "legal_simulation";


export interface CNSSRules {
  ceiling: number;
  contributions: {
    code: 'social_security_employee' | 'social_security_employer';
    role: 'employee' | 'employer';
    rate: number;
  }[];
}

export interface AMORules {
  base: 'gross' | 'capped';
  contributions: {
    code: 'health_insurance_employee' | 'health_insurance_employer';
    role: 'employee' | 'employer';
    rate: number;
  }[];
}

export interface IRBracket {
  min: number;
  max: number | null; // null means infinity
  rate: number;
  deduction: number;
}

export interface IRRules {
  method: "progressive_with_deduction";
  brackets: IRBracket[];
  familyDeductionPerDependent: number; // e.g. 360 MAD per dependent
  maxDependents: number; // e.g. 6
}

export interface FamilyAllowanceRules {
  tiers: { count: number; amount: number }[];
  maxChildren: number;
}

export interface FraisProRules {
  method: 'percentage_with_cap' | 'tiered';
  rate?: number; // e.g. 0.20
  annual_cap?: number; // e.g. 30000 MAD annually
  rules?: { minAnnualGross: number; maxAnnualGross: number | null; rate: number }[];
}

export interface SeniorityTier {
  yearsMin: number;
  yearsMax: number | null;
  rate: number;
}

export interface SeniorityRules {
  base: 'base_salary' | 'gross';
  tiers: SeniorityTier[];
}

export interface OvertimeRuleDef {
  type: 'day_normal' | 'night_normal' | 'holiday_day' | 'holiday_night';
  multiplier: number;
}

export interface OvertimeRules {
  rules: OvertimeRuleDef[];
}

export interface PayrollRules {
  schemaVersion: string;
  country: string;
  currency: string;
  calculationMode: string;
  year: number;
  pipeline: PayrollStep[];
  cnss: CNSSRules;
  amo: AMORules;
  ir: IRRules;
  familyAllowance: FamilyAllowanceRules;
  frais_professionnels: FraisProRules;
  seniority: SeniorityRules;
  overtime: OvertimeRules;
}
