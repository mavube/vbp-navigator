export type ProspectSource = "apply" | "assessment";
export type ProspectStatus = "new" | "reviewed" | "promoted" | "declined";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
}

export interface Prospect {
  id: string;
  serviceId: string | null;
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
