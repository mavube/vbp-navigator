import { NextRequest, NextResponse } from "next/server";
import {
  getDocument,
  updateCommercialContent,
  advanceDocumentStatus,
  markProposalAccepted,
  type DocumentLineItem,
  type DocumentStatus,
} from "@/lib/db-documents";
import { getUserContext, canManageService, canApproveBudget, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const MAX_LINE_ITEMS = 30;
// Phase 15: see the matching comment in app/api/commercial-documents/route.ts
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json(doc);
}

type Action = "submit" | "approve" | "reject" | "reopen" | "mark_acknowledged" | "mark_accepted";
const VALID_ACTIONS: Action[] = ["submit", "approve", "reject", "reopen", "mark_acknowledged", "mark_accepted"];

// PATCH /api/commercial-documents/:id — two shapes:
//
//   { action: "submit" | "approve" | "reject" | "reopen" | "mark_acknowledged" }
//     Lifecycle transitions. submit/reopen: that service's owner/
//     contributor or an org admin (same as everyday document work).
//     approve/reject: the org's Budget Approver or an org admin — same
//     money-decision authority as a Budget Request, because a
//     commercial document is now a real financial commitment.
//     mark_acknowledged: a MANUAL staff override for proposal/quotation
//     only ("the customer called and confirmed") — never available for
//     invoice, where acknowledgment is payment-driven only (see
//     lib/db-documents.ts's recordPayment) so staff can never claim a
//     payment that didn't happen.
//     mark_accepted: Phase 15, Proposal only — a manual staff
//     attestation that the customer accepted the Proposal, separate
//     from mark_acknowledged and from the internal `approved` status.
//     Unlocks POST /api/commercial-documents's fromAcceptedProposalId
//     path (create an Invoice from this Proposal).
//
//   { title, body, details, lineItems, amount, currency, dueDate }
//     Content edit — only while status = 'draft', same
//     "route checks, lib persists" split as the plain-letter Documents
//     module's regenerate endpoint.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (typeof body.action === "string") {
    if (!VALID_ACTIONS.includes(body.action as Action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const action = body.action as Action;

    if (action === "submit") {
      if (doc.status !== "draft") return NextResponse.json({ error: "Only a draft can be submitted for review" }, { status: 400 });
      if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      await advanceDocumentStatus(ctx.orgId, id, "under_review");
      return NextResponse.json({ id, status: "under_review" as DocumentStatus });
    }

    if (action === "approve" || action === "reject") {
      if (doc.status !== "under_review") return NextResponse.json({ error: "Only a document under review can be approved or rejected" }, { status: 400 });
      if (!canApproveBudget(ctx)) return NextResponse.json({ error: "Only the org's Budget Approver can decide this" }, { status: 403 });
      const status: DocumentStatus = action === "approve" ? "approved" : "rejected";
      await advanceDocumentStatus(ctx.orgId, id, status, { approvedByName: "" });
      return NextResponse.json({ id, status });
    }

    if (action === "reopen") {
      if (doc.status !== "rejected") return NextResponse.json({ error: "Only a rejected document can be reopened" }, { status: 400 });
      if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      await advanceDocumentStatus(ctx.orgId, id, "draft");
      return NextResponse.json({ id, status: "draft" as DocumentStatus });
    }

    if (action === "mark_accepted") {
      if (doc.docType !== "proposal") return NextResponse.json({ error: "Only a Proposal can be marked accepted" }, { status: 400 });
      if (!["approved", "issued", "sent", "delivered"].includes(doc.status)) {
        return NextResponse.json({ error: "Only an approved (or further-along) Proposal can be marked accepted" }, { status: 400 });
      }
      if (doc.acceptedAt) return NextResponse.json({ error: "This Proposal is already marked accepted" }, { status: 400 });
      if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      const acceptedByName = await resolveDisplayName(ctx, typeof body.acceptedByName === "string" ? body.acceptedByName : undefined);
      await markProposalAccepted(ctx.orgId, id, acceptedByName);
      const updated = await getDocument(ctx.orgId, id);
      return NextResponse.json(updated);
    }

    // mark_acknowledged
    if (doc.docType === "invoice") {
      return NextResponse.json({ error: "An invoice can only be acknowledged by a confirmed payment" }, { status: 400 });
    }
    if (!["sent", "delivered"].includes(doc.status)) {
      return NextResponse.json({ error: "Only a sent or delivered document can be marked acknowledged" }, { status: 400 });
    }
    if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    await advanceDocumentStatus(ctx.orgId, id, "acknowledged");
    return NextResponse.json({ id, status: "acknowledged" as DocumentStatus });
  }

  // Content edit.
  if (doc.status !== "draft") {
    return NextResponse.json({ error: "Only a draft document's content can be edited" }, { status: 400 });
  }
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const lineItems = parseLineItems(body.lineItems);
  const flatAmount = Number(body.amount);
  await updateCommercialContent(ctx.orgId, id, {
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 300) : doc.title,
    body: typeof body.body === "string" ? body.body.slice(0, 20000) : doc.body,
    details: typeof body.details === "string" ? body.details.slice(0, 8000) : doc.details,
    lineItems: lineItems.length > 0 ? lineItems : doc.lineItems,
    amount: lineItems.length > 0 ? null : (Number.isFinite(flatAmount) ? flatAmount : doc.amount),
    currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().slice(0, 10) : doc.currency,
    dueDate: typeof body.dueDate === "string" ? body.dueDate || null : doc.dueDate,
  });
  const updated = await getDocument(ctx.orgId, id);
  return NextResponse.json(updated);
}
