export type ProspectSource = "apply" | "assessment" | "manual";
export type ProspectStatus = "new" | "reviewed" | "promoted" | "declined";

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

export interface Prospect {
  id: string;
  serviceId: string | null;
  productServiceId: string | null;
  source: ProspectSource;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  assessmentAnswers: Record<string, unknown>;
  status: ProspectStatus;
  leadId: string | null;
  createdAt: string;
}
