import { NextRequest, NextResponse } from "next/server";
import { getDocument, regenerateDocument } from "@/lib/db-documents";
import { resolveDocumentAnchor } from "@/lib/document-context";
import { renderDocument } from "@/lib/document-templates";
import { getOrgName } from "@/lib/organizations";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// POST /api/documents/:id/regenerate — re-run the template with new
// `details` against the same anchor (lead or engagement), same row,
// same version. Only while the document is still a draft — once it's
// been submitted, the content shouldn't shift under an approver's feet;
// see app/api/documents/[id]/new-version/route.ts for how to change an
// already-approved document.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const details = typeof body.details === "string" ? body.details.slice(0, 8000) : "";

  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status !== "draft") return NextResponse.json({ error: "Only a draft can be regenerated" }, { status: 400 });
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const orgName = await getOrgName(ctx.orgId);
  const anchor = await resolveDocumentAnchor(ctx.orgId, orgName, doc.docType, doc.leadId, doc.engagementId);
  if (!anchor) return NextResponse.json({ error: "The lead or engagement this document is for no longer resolves" }, { status: 404 });

  const rendered = renderDocument(doc.docType, { ...anchor.context, details });
  await regenerateDocument(ctx.orgId, id, rendered.title, rendered.body, details);
  return NextResponse.json({ id, title: rendered.title, body: rendered.body, details });
}
