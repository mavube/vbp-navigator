export type LeadStage = "new" | "contacted" | "assessed" | "admitted" | "lost";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

export interface Lead {
  id: string;
  serviceId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stage: LeadStage;
  ownerId: string | null;
  notes: string;
}
