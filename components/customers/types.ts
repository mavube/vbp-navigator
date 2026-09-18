export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
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
