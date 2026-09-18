// Resolves a document's anchor (a Lead for pre-engagement types, an
// Engagement for post-engagement types) into the data
// lib/document-templates.ts needs to render — cross-module
// coordination that belongs in its own small file rather than
// duplicated between app/api/documents/route.ts and
// app/api/documents/[id]/new-version/route.ts, the two places that
// need it.

import { listServices } from "@/lib/db-services";
import { getLead } from "@/lib/db-leads";
import { getEngagement } from "@/lib/db-engagements";
import { getCustomerById } from "@/lib/db-customers";
import { PRE_ENGAGEMENT_TYPES, type DocumentContext, type DocumentType } from "@/lib/document-templates";

export interface ResolvedAnchor {
  serviceId: string;
  leadId: string | null;
  engagementId: string | null;
  customerId: string | null;
  recipientEmail: string;
  context: DocumentContext;
}

// Returns null when the anchor doesn't exist or the docType/anchor
// combination is invalid (e.g. a post-engagement type with no
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

  if (PRE_ENGAGEMENT_TYPES.has(docType)) {
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

export interface CommercialAnchorInput {
  serviceId?: string | null;
  leadId?: string | null;
  engagementId?: string | null;
  customerId?: string | null;
  recipientName?: string;
  recipientEmail?: string;
}

// Phase 14 — the flexible resolver for commercial documents
// (proposal/quotation/invoice). Unlike resolveDocumentAnchor above,
// none of the four anchor shapes is mandatory: an engagement (post-
// engagement, richest context), a lead (pre-engagement), a customer
// directly (no active engagement, e.g. a repeat one-off sale), or
// nothing at all — Diallo's "phone call, create invoice directly"
// case, where serviceId + recipientName + recipientEmail are simply
// typed in. Whichever anchor is given, it's resolved for real (a
// leadId/engagementId/customerId that doesn't exist returns null, same
// "don't invent data" rule as the pre-existing resolver) — this never
// fabricates a customer or service that isn't there.
export async function resolveCommercialAnchor(
  orgId: string,
  orgName: string,
  input: CommercialAnchorInput
): Promise<ResolvedAnchor | null> {
  const services = await listServices(orgId);

  if (input.engagementId) {
    const engagement = await getEngagement(orgId, input.engagementId);
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

  if (input.leadId) {
    const lead = await getLead(orgId, input.leadId);
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

  if (input.customerId) {
    if (!input.serviceId) return null; // a bare customer isn't tied to one service — the caller must say which
    const customer = await getCustomerById(orgId, input.customerId);
    if (!customer) return null;
    const service = services.find((s) => s.id === input.serviceId);
    if (!service) return null;
    return {
      serviceId: service.id,
      leadId: null,
      engagementId: null,
      customerId: customer.id,
      recipientEmail: customer.email,
      context: {
        orgName,
        serviceName: service.name,
        serviceDescription: service.description ?? "",
        customerNeed: service.customerNeed ?? "",
        recipientName: customer.fullName,
        details: "",
      },
    };
  }

  // No anchor at all — the phone/email order case. serviceId and a
  // real recipient name/email are the only requirements.
  if (!input.serviceId || !input.recipientName?.trim() || !input.recipientEmail?.trim()) return null;
  const service = services.find((s) => s.id === input.serviceId);
  if (!service) return null;
  return {
    serviceId: service.id,
    leadId: null,
    engagementId: null,
    customerId: null,
    recipientEmail: input.recipientEmail.trim(),
    context: {
      orgName,
      serviceName: service.name,
      serviceDescription: service.description ?? "",
      customerNeed: service.customerNeed ?? "",
      recipientName: input.recipientName.trim(),
      details: "",
    },
  };
}
