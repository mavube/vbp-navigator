export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  // Phase E (Customer Workspace rebuild) — an Engagement's "owner" is
  // its service's provider (who's accountable for delivering it), not
  // a field of its own on the Engagement row.
  providerName?: string | null;
}

// Phase C (portfolio correction) — see components/pipeline/types.ts's
// identical ProductOption for the reasoning.
export interface ProductOption {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  organizationName: string;
  sourceLeadId: string | null;
  createdAt: string;
}

export type EngagementStatus = "active" | "completed" | "paused";

export interface Engagement {
  id: string;
  customerId: string;
  serviceId: string;
  productServiceId: string | null;
  leadId: string | null;
  status: EngagementStatus;
  startedAt: string;
  outcomeNote: string;
}

// --- Phase E (Customer Workspace rebuild) additions below ---

export interface ClassOption {
  id: string;
  serviceId: string;
  productServiceId: string | null;
  title: string;
  scheduledDate: string | null;
  status: string;
}

export type EnrollmentStatus = "enrolled" | "waitlisted" | "withdrawn";

export interface Enrollment {
  id: string;
  classId: string;
  customerId: string;
  status: EnrollmentStatus;
}

// The `documents` table backs both the five plain letter types
// (GET /api/documents) and the three commercial types
// (GET /api/commercial-documents) — same row shape either way (see
// lib/db-documents.ts's single DocumentRow), so one type here covers
// both instead of duplicating it per source.
export interface CustomerDocument {
  id: string;
  docType: string;
  title: string;
  status: string;
  amount: number | null;
  currency: string;
  paymentStatus: string;
  dueDate: string | null;
  issuedByName: string;
  createdByName: string;
  customerId: string | null;
  engagementId: string | null;
  createdAt: string;
}
