import { NextRequest, NextResponse } from "next/server";
import { listQuotations, createQuotation, getBudgetRequestServiceId } from "@/lib/db-budget";
import { getUserContext, canManageService, canApproveBudget } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/budget-requests/:id/quotations — vendor quotes attached to
// this budget request.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const quotations = await listQuotations(ctx.orgId, id);
  return NextResponse.json(quotations);
}

// POST /api/budget-requests/:id/quotations — attach a vendor quote.
// Per the alignment doc Section 6, Jennifer (as a Service Owner)
// typically prepares these — gated the same as managing the request's
// service, or the org-wide Budget Approver.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.vendor !== "string" || !body.vendor.trim()) {
    return NextResponse.json({ error: "vendor is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getBudgetRequestServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Budget request not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId) && !canApproveBudget(ctx)) {
    return NextResponse.json({ error: "Not allowed to add a quotation to this request" }, { status: 403 });
  }

  const quotation = await createQuotation(ctx.orgId, id, body.vendor.trim().slice(0, 200), amount);
  return NextResponse.json(quotation, { status: 201 });
}
