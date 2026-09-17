import { NextRequest, NextResponse } from "next/server";
import { listDocumentsByTypes, createDocument, getDocument, type DocumentLineItem } from "@/lib/db-documents";
import { resolveCommercialAnchor } from "@/lib/document-context";
import { renderDocument, COMMERCIAL_TYPES, type DocumentType } from "@/lib/document-templates";
import { getOrgName } from "@/lib/organizations";
import { getUserContext, canManageService, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TYPES: DocumentType[] = ["proposal", "quotation", "invoice"];
const MAX_LINE_ITEMS = 30;

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
    items.push({ description, quantity, unitAmount });
  }
  return items;
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
//   Converted: parentDocumentId + docType (must differ from the
//   parent's own type) — inherits service/lead/engagement/customer/
//   recipient/line items/amount/currency/due date from the parent
//   rather than re-typing them ("field inheritance, not duplicate
//   entry"), and only a document that's actually reached 'approved' or
//   further can be converted from — converting a still-editable draft
//   makes no sense (there's nothing final to inherit yet).
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

  if (parentDocumentId) {
    const parent = await getDocument(ctx.orgId, parentDocumentId);
    if (!parent) return NextResponse.json({ error: "Source document not found" }, { status: 404 });
    if (!COMMERCIAL_TYPES.has(parent.docType)) {
      return NextResponse.json({ error: "Only a commercial document can be converted" }, { status: 400 });
    }
    if (!["approved", "issued", "sent", "delivered", "acknowledged"].includes(parent.status)) {
      return NextResponse.json({ error: "Only an approved (or further-along) document can be converted" }, { status: 400 });
    }
    if (parent.docType === docType) {
      return NextResponse.json({ error: "Converting to the same document type doesn't make sense" }, { status: 400 });
    }
    if (!canManageService(ctx, parent.serviceId)) {
      return NextResponse.json({ error: "Not allowed to convert documents for this service" }, { status: 403 });
    }

    const rendered = renderDocument(docType, {
      orgName, serviceName: "", serviceDescription: "", customerNeed: "",
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
