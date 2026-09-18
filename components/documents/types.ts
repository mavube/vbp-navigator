export type DocumentType =
  | "proposal"
  | "quotation"
  | "invitation"
  | "approval_request"
  | "confirmation"
  | "welcome_communication"
  | "completion_record";

export type DocumentStatus = "draft" | "pending_approval" | "approved" | "rejected";

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

export interface DocumentRecord {
  id: string;
  serviceId: string;
  leadId: string | null;
  engagementId: string | null;
  customerId: string | null;
  docType: DocumentType;
  title: string;
  body: string;
  details: string;
  recipientName: string;
  recipientEmail: string;
  status: DocumentStatus;
  version: number;
  previousVersionId: string | null;
  sentAt: string | null;
  createdByName: string;
  approvedByName: string;
  attachmentUrl: string;
  createdAt: string;
}
