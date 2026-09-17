export type CommercialDocType = "proposal" | "quotation" | "invoice";

export type CommercialStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "rejected"
  | "issued"
  | "sent"
  | "delivered"
  | "acknowledged";

export type PaymentStatus = "not_applicable" | "unpaid" | "paid" | "failed" | "refunded";

export interface LineItem {
  description: string;
  quantity: number;
  unitAmount: number;
}

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
}
export interface LeadOption {
  id: string;
  serviceId: string;
  contactName: string;
  stage: string;
}
export interface CustomerOption {
  id: string;
  fullName: string;
}
export interface EngagementOption {
  id: string;
  customerId: string;
  serviceId: string;
  status: string;
}

export interface CommercialDocument {
  id: string;
  serviceId: string;
  leadId: string | null;
  engagementId: string | null;
  customerId: string | null;
  docType: CommercialDocType;
  title: string;
  body: string;
  details: string;
  recipientName: string;
  recipientEmail: string;
  status: CommercialStatus;
  parentDocumentId: string | null;
  amount: number | null;
  currency: string;
  lineItems: LineItem[];
  dueDate: string | null;
  paymentStatus: PaymentStatus;
  dpoTransToken: string | null;
  paidAt: string | null;
  accessToken: string | null;
  issuedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  issuedByName: string;
  documentNumber: string | null;
  createdByName: string;
  createdAt: string;
}
