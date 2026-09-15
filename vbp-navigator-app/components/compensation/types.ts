export type CompensationStatus = "draft" | "finalized";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

export interface AllowanceLine {
  name: string;
  amount: number;
}

export interface DeductionLine {
  name: string;
  amount: number;
}

export interface CompensationEntry {
  id: string;
  serviceId: string;
  employeeName: string;
  period: string;
  basicPay: number;
  allowances: AllowanceLine[];
  deductions: DeductionLine[];
  netPay: number;
  status: CompensationStatus;
}
