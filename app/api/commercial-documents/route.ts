import { NextRequest, NextResponse } from "next/server";
import { listDocumentsByTypes, createDocument, getDocument, type DocumentLineItem } from "@/lib/db-documents";
import { resolveCommercialAnchor } from "@/lib/document-context";
import { renderDocument, COMMERCIAL_TYPES, type DocumentType } from "@/lib/document-templates";
import { getOrgName } from "@/lib/organizations";
import { listServices } from "@/lib/db-services";
import { getUserContext, canManageService, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TYPES: DocumentType[] = ["proposal", "quotation", "invoice"];
const MAX_LINE_ITEMS = 30;

// Phase 15: a line item may now carry catalogItemId (which
// lib/db-price-catalog.ts item it was selected from, or null for a
// hand-typed custom line) and taxRate (the percentage snapshotted at
// selection time) — both optional so a pre-Phase-15 document's items,
// which have neither, still round-trip unchanged.
function parseLineItems(body: unknown): DocumentLineItem[] {
  if (!Array.isArray(body)) return [];
  const items: DocumentLineItem[] = [];
  for (const raw of body.slice(0, MAX_LINE_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const rawItem = raw as Record<string, unknown>;
    const description = typeof rawItem.description === "string" ? rawItem.description.trim().slice(0, 300) : "";
    const quantity = Number(rawItem.quantity);
    const unitAmount = Number(rawItem.unitAmount);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitAmount) || unitAmount < 0) continue;
    const catalogItemId = typeof rawItem.catalogItemId === "string" && rawItem.catalogItemId ? rawItem.catalogItemId : null;
    const rawTaxRate = rawItem.taxRate;
    const taxRate = rawTaxRate === null || rawTaxRate === undefined
      ? null
      : (Number.isFinite(Number(rawTaxRate)) ? Math.max(0, Math.min(100, Number(rawTaxRate))) : null);
    items.push({ description, quantity, unitAmount, catalogItemId, taxRate });
  }
  return items;
}

async function serviceNameFor(orgId: string, serviceId: string): Promise<string> {
  const services = await listServices(orgId);
  return services.find((s) => s.id === serviceId)?.name ?? "";
}

// GET /api/commercial-documents — proposals, quotations, and invoices
// only (see lib/db-documents.ts's listDocumentsByTypes) — the plain
// letter types (invitation, confirmation, …) stay on /api/documents.
export async function GET() {
  const ctx = await getUserContext();
  const documents = await listDocumentsByTypes(ctx.orgId, VALID_TYPES);
  return NextResponse.json(documents);
}

// POST /api/commercial-documents — create a commercial document. Two
// shapes, distinguished by whether parentDocumentId is given:
//
//   Standalone: docType + serviceId, plus ONE of leadId/engagementId/
//   customerId, or none of the three with recipientName/recipientEmail
//   typed directly (see lib/document-context.ts's
//   resolveCommercialAnchor for the flexible-anchor logic this is
//   Diallo's own requirement for — "not every transaction starts with
//   a proposal... some start directly with an invoice").
//
//   Converted: parentDocumentId + docType — inherits service/lead/
//   engagement/customer/recipient/line items/amount/currency/due date
//   from the parent rather than re-typing them ("field inheritance, not
//   duplicate entry"), and only a document that's actually reached
//   'approved' or further can be converted from — converting a
//   still-editable draft makes no sense (there's nothing final to
//   inherit yet). Phase 15 correction: the ONLY allowed conversion pair
//   is Quotation -> Invoice. A Proposal can no longer convert directly
//   into a Quotation or an Invoice via this mechanism — Diallo: "a
//   proposal normally have more text/details and clarifications,"
//   which doesn't map onto an Invoice's structured line items the way
//   a Quotation's already-structured items do. See fromAcceptedProposalId
//   below for a Proposal's actual path to an Invoice.
//
//   From an accepted Proposal: fromAcceptedProposalId + docType must be
//   "invoice" — the proposal must already be marked accepted (see
//   PATCH .../[id] action "mark_accepted"). Inherits the anchor
//   (service/lead/engagement/customer) and recipient/currency, but
//   deliberately NOT the proposal's line items or amount — a Proposal's
//   content is prose, not a priced breakdown, so the new Invoice starts
//   with an empty, catalog-driven line-item list for staff to fill in.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (typeof body.docType !== "string" || !VALID_TYPES.includes(body.docType as DocumentType)) {
    return NextResponse.json({ error: "docType must be proposal, quotation, or invoice" }, { status: 400 });
  }
  const docType = body.docType as DocumentType;
  const ctx = await getUserContext();
  const orgName = await getOrgName(ctx.orgId);
  const details = typeof body.details === "string" ? body.details.slice(0, 8000) : "";
  const lineItems = parseLineItems(body.lineItems);
  const flatAmount = Number(body.amount);
  const amount = lineItems.length > 0 ? lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0) : (Number.isFinite(flatAmount) ? flatAmount : null);
  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().slice(0, 10) : "TZS";
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;

  const parentDocumentId = typeof body.parentDocumentId === "string" && body.parentDocumentId ? body.parentDocumentId : null;
  const fromAcceptedProposalId = typeof body.fromAcceptedProposalId === "string" && body.fromAcceptedProposalId ? body.fromAcceptedProposalId : null;

  if (fromAcceptedProposalId) {
    if (docType !== "invoice") {
      return NextResponse.json({ error: "An accepted Proposal can only create an Invoice" }, { status: 400 });
    }
    const proposal = await getDocument(ctx.orgId, fromAcceptedProposalId);
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    if (proposal.docType !== "proposal") {
      return NextResponse.json({ error: "This path is only for a Proposal" }, { status: 400 });
    }
    if (!proposal.acceptedAt) {
      return NextResponse.json({ error: "Mark this Proposal accepted first" }, { status: 400 });
    }
    if (!canManageService(ctx, proposal.serviceId)) {
      return NextResponse.json({ error: "Not allowed to create documents for this service" }, { status: 403 });
    }

    const rendered = renderDocument("invoice", {
      orgName, serviceName: await serviceNameFor(ctx.orgId, proposal.serviceId), serviceDescription: "", customerNeed: "",
      recipientName: proposal.recipientName, details: proposal.details,
    });
    const createdByName = await resolveDisplayName(ctx, typeof body.createdByName === "string" ? body.createdByName : undefined);
    const doc = await createDocument(ctx.orgId, {
      serviceId: proposal.serviceId,
      leadId: proposal.leadId,
      engagementId: proposal.engagementId,
      customerId: proposal.customerId,
      docType: "invoice",
      title: rendered.title,
      body: rendered.body,
      details: proposal.details,
      recipientName: proposal.recipientName,
      recipientEmail: proposal.recipientEmail,
      createdByName,
      parentDocumentId: proposal.id,
      amount: null,
      currency: proposal.currency,
      lineItems: [],
      dueDate: null,
    });
    return NextResponse.json(doc, { status: 201 });
  }

  if (parentDocumentId) {
    const parent = await getDocument(ctx.orgId, parentDocumentId);
    if (!parent) return NextResponse.json({ error: "Source document not found" }, { status: 404 });
    if (!COMMERCIAL_TYPES.has(parent.docType)) {
      return NextResponse.json({ error: "Only a commercial document can be converted" }, { status: 400 });
    }
    if (!["approved", "issued", "sent", "delivered", "acknowledged"].includes(parent.status)) {
      return NextResponse.json({ error: "Only an approved (or further-along) document can be converted" }, { status: 400 });
    }
    if (!(parent.docType === "quotation" && docType === "invoice")) {
      return NextResponse.json(
        { error: "Only a Quotation can be converted to an Invoice. A Proposal can't convert directly — mark it accepted, then create an Invoice from it." },
        { status: 400 }
      );
    }
    if (!canManageService(ctx, parent.serviceId)) {
      return NextResponse.json({ error: "Not allowed to convert documents for this service" }, { status: 403 });
    }

    const rendered = renderDocument(docType, {
      orgName, serviceName: await serviceNameFor(ctx.orgId, parent.serviceId), serviceDescription: "", customerNeed: "",
      recipientName: parent.recipientName, details: parent.details,
    });
    const createdByName = await resolveDisplayName(ctx, typeof body.createdByName === "string" ? body.createdByName : undefined);
    const doc = await createDocument(ctx.orgId, {
      serviceId: parent.serviceId,
      leadId: parent.leadId,
      engagementId: parent.engagementId,
      customerId: parent.customerId,
      docType,
      title: rendered.title,
      body: rendered.body,
      details: parent.details,
      recipientName: parent.recipientName,
      recipientEmail: parent.recipientEmail,
      createdByName,
      parentDocumentId: parent.id,
      amount: parent.amount,
      currency: parent.currency,
      lineItems: parent.lineItems,
      dueDate: parent.dueDate,
    });
    return NextResponse.json(doc, { status: 201 });
  }

  // Standalone creation.
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : null;
  const anchor = await resolveCommercialAnchor(ctx.orgId, orgName, {
    serviceId,
    leadId: typeof body.leadId === "string" && body.leadId ? body.leadId : null,
    engagementId: typeof body.engagementId === "string" && body.engagementId ? body.engagementId : null,
    customerId: typeof body.customerId === "string" && body.customerId ? body.customerId : null,
    recipientName: typeof body.recipientName === "string" ? body.recipientName : undefined,
    recipientEmail: typeof body.recipientEmail === "string" ? body.recipientEmail : undefined,
  });
  if (!anchor) {
    return NextResponse.json(
      { error: "Couldn't resolve who this is for — give a lead, an engagement, a customer, or a service plus recipient name/email" },
      { status: 400 }
    );
  }
  if (!canManageService(ctx, anchor.serviceId)) {
    return NextResponse.json({ error: "Not allowed to create documents for this service" }, { status: 403 });
  }

  const recipientNameOverride = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
  const recipientEmailOverride = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";

  const rendered = renderDocument(docType, {
    ...anchor.context,
    details,
    ...(recipientNameOverride ? { recipientName: recipientNameOverride } : {}),
  });
  const createdByName = await resolveDisplayName(ctx, typeof body.createdByName === "string" ? body.createdByName : undefined);

  const doc = await createDocument(ctx.orgId, {
    serviceId: anchor.serviceId,
    leadId: anchor.leadId,
    engagementId: anchor.engagementId,
    customerId: anchor.customerId,
    docType,
    title: rendered.title,
    body: rendered.body,
    details,
    recipientName: recipientNameOverride || anchor.context.recipientName,
    recipientEmail: recipientEmailOverride || anchor.recipientEmail,
    createdByName,
    amount,
    currency,
    lineItems,
    dueDate,
  });
  return NextResponse.json(doc, { status: 201 });
}
