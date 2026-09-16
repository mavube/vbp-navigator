// Resolves a document's anchor (a Lead for pre-admission types, an
// Engagement for post-admission types) into the data
// lib/document-templates.ts needs to render — cross-module
// coordination that belongs in its own small file rather than
// duplicated between app/api/documents/route.ts and
// app/api/documents/[id]/new-version/route.ts, the two places that
// need it.

import { listServices } from "@/lib/db-services";
import { getLead } from "@/lib/db-leads";
import { getEngagement } from "@/lib/db-engagements";
import { getCustomerById } from "@/lib/db-customers";
import { PRE_ADMISSION_TYPES, type DocumentContext, type DocumentType } from "@/lib/document-templates";

export interface ResolvedAnchor {
  serviceId: string;
  leadId: string | null;
  engagementId: string | null;
  customerId: string | null;
  recipientEmail: string;
  context: DocumentContext;
}

// Returns null when the anchor doesn't exist or the docType/anchor
// combination is invalid (e.g. a post-admission type with no
// engagementId) — the caller turns that into a 400/404, this file
// stays free of NextResponse/HTTP concerns.
export async function resolveDocumentAnchor(
  orgId: string,
  orgName: string,
  docType: DocumentType,
  leadId: string | null,
  engagementId: string | null
): Promise<ResolvedAnchor | null> {
  const services = await listServices(orgId);

  if (PRE_ADMISSION_TYPES.has(docType)) {
    if (!leadId) return null;
    const lead = await getLead(orgId, leadId);
    if (!lead) return null;
    const service = services.find((s) => s.id === lead.serviceId);
    return {
      serviceId: lead.serviceId,
      leadId: lead.id,
      engagementId: null,
      customerId: null,
      recipientEmail: lead.contactEmail,
      context: {
        orgName,
        serviceName: service?.name ?? "Unknown service",
        serviceDescription: service?.description ?? "",
        customerNeed: service?.customerNeed ?? "",
        recipientName: lead.contactName,
        details: "",
      },
    };
  }

  if (!engagementId) return null;
  const engagement = await getEngagement(orgId, engagementId);
  if (!engagement) return null;
  const customer = await getCustomerById(orgId, engagement.customerId);
  if (!customer) return null;
  const service = services.find((s) => s.id === engagement.serviceId);
  return {
    serviceId: engagement.serviceId,
    leadId: engagement.leadId,
    engagementId: engagement.id,
    customerId: engagement.customerId,
    recipientEmail: customer.email,
    context: {
      orgName,
      serviceName: service?.name ?? "Unknown service",
      serviceDescription: service?.description ?? "",
      customerNeed: service?.customerNeed ?? "",
      recipientName: customer.fullName,
      details: "",
      engagementStartDate: engagement.startedAt,
    },
  };
}
