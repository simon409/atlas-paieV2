export interface PayrollInput {
  baseSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  dependentsCount: number;
  childrenCount: number;
  irMode?: "simplified" | "legal_simulation";
  cumulativeIR?: CumulativeIRContext;
}

export interface CumulativeIRContext {
  month: number;
  previousTaxableIncome: number;
  previousIRWithheld: number;
}

export interface PayrollResult {
  grossSalary: number;
  cnssEmployee: number;
  cnssEmployer: number;
  amoEmployee: number;
  amoEmployer: number;
  fraisProfessionnels: number;
  netTaxable: number;
  irBrut: number;
  irNet: number;
  familyAllowance: number;
  netSalary: number;
  employerCost: number;
  breakdown: {
    baseSalary: number;
    allowances: number;
    bonuses: number;
    deductions: number;
  };
  trace: string[];
  annualization?: {
    month: number;
    cumulativeTaxableIncome: number;
    annualizedTaxableIncome: number;
    annualIR: number;
    cumulativeIRDue: number;
    previousIRWithheld: number;
  };
}
