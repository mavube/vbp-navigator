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

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
}

export interface Invoice {
  id: string;
  serviceId: string;
  classId: string | null;
  leadId: string | null;
  direction: InvoiceDirection;
  party: string;
  amount: number;
  lineItems: InvoiceLineItem[];
  dueDate: string | null;
  status: InvoiceStatus;
}

export interface ClassOption {
  id: string;
  serviceId: string;
  title: string;
}

export interface LeadOption {
  id: string;
  serviceId: string;
  contactName: string;
}
