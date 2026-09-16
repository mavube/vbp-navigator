import { NextRequest, NextResponse } from "next/server";
import { getDocument, updateDocumentStatus, markDocumentSent } from "@/lib/db-documents";
import { getUserContext, canManageService, canApproveBudget, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Action = "submit" | "approve" | "reject" | "mark_sent";
const VALID_ACTIONS: Action[] = ["submit", "approve", "reject", "mark_sent"];

// PATCH /api/documents/:id — the document's status-transition actions.
// One route for all four rather than four routes, since they share the
// same "load the document, check who's allowed, apply the transition"
// shape and none needs its own request body beyond the action itself.
//
//   submit    draft            -> pending_approval  (that service's owner/contributor or org admin)
//   approve   pending_approval -> approved           (org's Budget Approver or org admin — same authority as Budget Requests/Compensation)
//   reject    pending_approval -> rejected            (same authority as approve)
//   mark_sent approved         -> approved + sentAt   (that service's owner/contributor or org admin — recording an outside-the-app action, not an approval decision)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.action !== "string" || !VALID_ACTIONS.includes(body.action as Action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const action = body.action as Action;

  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (action === "submit") {
    if (doc.status !== "draft") return NextResponse.json({ error: "Only a draft can be submitted for approval" }, { status: 400 });
    if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    await updateDocumentStatus(ctx.orgId, id, "pending_approval");
    return NextResponse.json({ id, status: "pending_approval" });
  }

  if (action === "approve" || action === "reject") {
    if (doc.status !== "pending_approval") return NextResponse.json({ error: "Only a pending document can be approved or rejected" }, { status: 400 });
    if (!canApproveBudget(ctx)) return NextResponse.json({ error: "Only the org's Budget Approver can decide this" }, { status: 403 });
    const approvedByName = await resolveDisplayName(ctx, undefined);
    const status = action === "approve" ? "approved" : "rejected";
    await updateDocumentStatus(ctx.orgId, id, status, approvedByName);
    return NextResponse.json({ id, status });
  }

  // mark_sent
  if (doc.status !== "approved") return NextResponse.json({ error: "Only an approved document can be marked sent" }, { status: 400 });
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  await markDocumentSent(ctx.orgId, id);
  return NextResponse.json({ id, sent: true });
}
