export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
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
  leadId: string | null;
  status: EngagementStatus;
  startedAt: string;
  outcomeNote: string;
}
