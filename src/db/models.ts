export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type ContractType = "CDI" | "CDD" | "ANAPEC" | "STAGE" | "OTHER";

export type Employee = {
  id: string;
  matricule: string;
  cin: string;
  cnssNumber: string;
  fullName: string;
  hireDate: string;
  seniorityDate: string;
  birthDate: string;
  familyStatus: string;
  childrenCount: number;
  deductionCount: number;
  functionTitle: string;
  department: string;
  contractType: ContractType;
  salaryBase: number;
  status: EmployeeStatus;
  companyId: string;
};

export type EmployeeDraft = Omit<Employee, "id" | "companyId" | "status"> & {
  status?: EmployeeStatus;
  companyId?: string;
};

export type Company = {
  id: string;
  name: string;
  ice: string;
  cnssAffiliation: string;
  createdAt: Date;
};

export type CompanyDraft = Omit<Company, "id" | "createdAt">;

export type DatabaseStatus = {
  provider: "sqlite" | "local";
  ready: boolean;
  message: string;
};

export type PayrollRunStatus = "DRAFT" | "LOCKED";

export type PayrollRun = {
  id: string;
  companyId: string;
  period: string;
  ruleVersion: number;
  status: PayrollRunStatus;
  totalGross: number;
  totalNet: number;
  totalEmployerCost: number;
};

export type PayrollItem = {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  employeeMatricule: string;
  _period?: string; // Virtual field for easier access in UI, not stored in DB
  rulesVersion: number;
  rulesSnapshot: string;
  inputSnapshot: string;
  calculationHash: string;
  grossSalary: number;
  netSalary: number;
  cnssEmployee: number;
  cnssEmployer: number;
  ir: number;
  amo: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  taxableIncome: number;
  professionalExpenses: number;
  cumulativeTaxableIncome: number | null;
  previousIrWithheld: number | null;
  cumulativeIrDue: number | null;
  roundingCarryForward: number;
  roundingDiff: number;
  traceJson: string;
};

export type PayrollItemLineType = "EARNING" | "DEDUCTION" | "EMPLOYER" | "INFO";

export type PayrollItemLine = {
  id: string;
  payrollItemId: string;
  code: string;
  label: string;
  type: PayrollItemLineType;
  baseAmount: number | null;
  rate: number | null;
  amount: number;
  sortOrder: number;
};

export type MovementType =
  | "BONUS"
  | "TAXABLE_ALLOWANCE"
  | "NON_TAXABLE_ALLOWANCE"
  | "DEDUCTION";

export type MovementScope = "employee" | "group" | "all";

export type PayrollMovement = {
  id: string;
  companyId: string;
  dateDebut: string;
  dateFin: string;
  employeeId: string | null;
  scope: MovementScope;
  type: MovementType;
  label: string;
  amount: number;
  createdAt: Date;
};

export type AppUser = {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export type PayrollMovementDraft = Omit<PayrollMovement, "id" | "companyId" | "createdAt">;
