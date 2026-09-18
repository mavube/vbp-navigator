export type LeadStage = "new" | "contacted" | "assessed" | "admitted" | "lost";

export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
}

// Phase C (portfolio correction) — a Products & Services Catalog item,
// as offered to a lead/prospect/class picker. Trimmed to what a picker
// needs, not the full catalog shape (see lib/db-price-catalog.ts).
export interface ProductOption {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

export interface Lead {
  id: string;
  serviceId: string;
  productServiceId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stage: LeadStage;
  ownerId: string | null;
  notes: string;
}
