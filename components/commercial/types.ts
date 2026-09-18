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

// Phase 15: catalogItemId/taxRate are optional so a pre-Phase-15 line
// item (created before the predefined-services catalog existed) keeps
// rendering and editing fine — see lib/db-documents.ts's
// DocumentLineItem comment for the full snapshot-at-selection-time
// reasoning.
export interface LineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  catalogItemId?: string | null;
  taxRate?: number | null;
}

export interface PriceCatalogItemOption {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  currency: string;
  taxRate: number | null;
  active: boolean;
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
  acceptedAt: string | null;
  acceptedByName: string;
  createdByName: string;
  createdAt: string;
}
