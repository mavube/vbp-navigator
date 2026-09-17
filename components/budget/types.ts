export type BudgetSource = "petty_cash" | "direct";
export type BudgetStatus = "pending" | "approved" | "rejected";
export type InvoiceDirection = "incoming" | "outgoing";
export type InvoiceStatus = "unpaid" | "paid" | "overdue";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

export interface BudgetRequest {
  id: string;
  serviceId: string;
  source: BudgetSource;
  purpose: string;
  amount: number;
  status: BudgetStatus;
  neededBy: string | null;
}

export interface Quotation {
  id: string;
  budgetRequestId: string;
  vendor: string;
  amount: number;
}

export interface Expense {
  id: string;
  serviceId: string;
  budgetRequestId: string | null;
  amount: number;
  expenseDate: string;
  description: string;
  receiptUrl: string;
}

export interface Invoice {
  id: string;
  serviceId: string;
  direction: InvoiceDirection;
  party: string;
  amount: number;
  dueDate: string | null;
  status: InvoiceStatus;
}
