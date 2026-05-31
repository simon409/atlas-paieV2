export interface CnssDeclarationLine {
  matricule: string;
  fullName: string;
  cnssNumber: string | null;
  cin: string;
  grossSalary: number;
  cnssBase: number;
  amoBase: number;
  employeeCnss: number;
  employerCnss: number;
  employeeAmo: number;
  employerAmo: number;
  ir: number | null;
  netSalary: number | null;
  familyAllowance: number | null;
}

export interface CnssDeclarationTotals {
  employeeCount: number;
  totalGross: number;
  totalCnssBase: number;
  totalAmoBase: number;
  totalEmployeeCnss: number;
  totalEmployerCnss: number;
  totalEmployeeAmo: number;
  totalEmployerAmo: number;
  totalIr: number;
  totalNet: number;
}

export interface DamancomRecord {
  cnssNumber: string;
  fullName: string;
  cin: string;
  grossSalary: number;
  cnssBase: number;
  employeeCnss: number;
  employerCnss: number;
}
