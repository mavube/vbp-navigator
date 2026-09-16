import { NextRequest, NextResponse } from "next/server";
import { getDocument, createDocument } from "@/lib/db-documents";
import { resolveDocumentAnchor } from "@/lib/document-context";
import { renderDocument } from "@/lib/document-templates";
import { getOrgName } from "@/lib/organizations";
import { getUserContext, canManageService, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// POST /api/documents/:id/new-version — the "versioned" half of Phase
// 5: an approved document is immutable (see regenerate/route.ts's
// comment), so changing one after approval means opening a new draft
// row instead — version = previous + 1, previousVersionId set, same
// anchor. The old approved row is untouched and stays in the list as
// its own historical record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const details = typeof body.details === "string" ? body.details.slice(0, 8000) : "";

  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status !== "approved" && doc.status !== "rejected") {
    return NextResponse.json({ error: "A new version can only be started from an approved or rejected document" }, { status: 400 });
  }
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const orgName = await getOrgName(ctx.orgId);
  const anchor = await resolveDocumentAnchor(ctx.orgId, orgName, doc.docType, doc.leadId, doc.engagementId);
  if (!anchor) return NextResponse.json({ error: "The lead or engagement this document is for no longer resolves" }, { status: 404 });

  const effectiveDetails = details || doc.details;
  const rendered = renderDocument(doc.docType, { ...anchor.context, details: effectiveDetails });
  const createdByName = await resolveDisplayName(ctx, typeof body.createdByName === "string" ? body.createdByName : undefined);

  const newDoc = await createDocument(ctx.orgId, {
    serviceId: anchor.serviceId,
    leadId: anchor.leadId,
    engagementId: anchor.engagementId,
    customerId: anchor.customerId,
    docType: doc.docType,
    title: rendered.title,
    body: rendered.body,
    details: effectiveDetails,
    recipientName: anchor.context.recipientName,
    recipientEmail: anchor.recipientEmail,
    createdByName,
    version: doc.version + 1,
    previousVersionId: doc.id,
  });
  return NextResponse.json(newDoc, { status: 201 });
}
