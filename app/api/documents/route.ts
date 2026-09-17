import { NextRequest, NextResponse } from "next/server";
import { listDocuments, createDocument } from "@/lib/db-documents";
import { resolveDocumentAnchor } from "@/lib/document-context";
import { renderDocument, PRE_ADMISSION_TYPES, type DocumentType } from "@/lib/document-templates";
import { getOrgName } from "@/lib/organizations";
import { getUserContext, canManageService, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TYPES: DocumentType[] = [
  "proposal", "quotation", "invitation", "approval_request",
  "confirmation", "admission_communication", "completion_record",
];

// GET /api/documents — every document for the org, newest first. Same
// org-wide visibility as everything else.
export async function GET() {
  const ctx = await getUserContext();
  const documents = await listDocuments(ctx.orgId);
  return NextResponse.json(documents);
}

// POST /api/documents — generate a new draft (v3.0 roadmap Phase 5).
// Pre-admission types (proposal/quotation/invitation/approval_request)
// take leadId; post-admission types (confirmation/
// admission_communication/completion_record) take engagementId — see
// lib/document-templates.ts's PRE_ADMISSION_TYPES/POST_ADMISSION_TYPES.
// Gated the same as recording an Expense (that service's owner/
// contributor or an org admin) — a generated document is a real
// outward-facing artifact, not an open-creation item like a Task.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (typeof body.docType !== "string" || !VALID_TYPES.includes(body.docType as DocumentType)) {
    return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
  }
  const docType = body.docType as DocumentType;
  const leadId = typeof body.leadId === "string" && body.leadId ? body.leadId : null;
  const engagementId = typeof body.engagementId === "string" && body.engagementId ? body.engagementId : null;
  const details = typeof body.details === "string" ? body.details.slice(0, 8000) : "";

  const expectedAnchor = PRE_ADMISSION_TYPES.has(docType) ? "leadId" : "engagementId";
  if (expectedAnchor === "leadId" && !leadId) {
    return NextResponse.json({ error: "leadId is required for this document type" }, { status: 400 });
  }
  if (expectedAnchor === "engagementId" && !engagementId) {
    return NextResponse.json({ error: "engagementId is required for this document type" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const orgName = await getOrgName(ctx.orgId);
  const anchor = await resolveDocumentAnchor(ctx.orgId, orgName, docType, leadId, engagementId);
  if (!anchor) {
    return NextResponse.json({ error: "Couldn't find the lead or engagement this document is for" }, { status: 404 });
  }
  if (!canManageService(ctx, anchor.serviceId)) {
    return NextResponse.json({ error: "Not allowed to generate documents for this service" }, { status: 403 });
  }

  // Quick win: recipientName/recipientEmail are otherwise always
  // derived from the linked lead/engagement — fine for the normal
  // case, but there was no way to override them for a one-off (e.g.
  // the document actually needs to go to someone else at the same
  // organization). An override is used only when non-empty; an empty
  // or missing override falls back to the anchor-derived default, same
  // as before this change.
  const recipientNameOverride = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
  const recipientEmailOverride = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  // v3.0 roadmap Phase 10 (Cluster C) — an optional link to wherever the
  // actual file already lives (see lib/db-documents.ts's comment on
  // DocumentRow.attachmentUrl for why this is a link, not an upload).
  const attachmentUrl = typeof body.attachmentUrl === "string" ? body.attachmentUrl.trim().slice(0, 2000) : "";

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
    attachmentUrl,
  });
  return NextResponse.json(doc, { status: 201 });
}
