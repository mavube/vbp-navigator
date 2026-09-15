import { NextRequest, NextResponse } from "next/server";
import { getBudgetRequestServiceId, updateBudgetRequestStatus, type BudgetStatus } from "@/lib/db-budget";
import { getUserContext, canApproveBudget } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: BudgetStatus[] = ["approved", "rejected"];

// PATCH /api/budget-requests/:id — approve or reject. Restricted to the
// org-wide Budget Approver (Anne at VBP) or an Org Admin, regardless of
// which service the request is against — see lib/permissions.ts's
// canApproveBudget and the alignment doc Section 4.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as BudgetStatus)) {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getBudgetRequestServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Budget request not found" }, { status: 404 });
  }
  if (!canApproveBudget(ctx)) {
    return NextResponse.json({ error: "Only the org's Budget Approver can approve or reject requests" }, { status: 403 });
  }

  await updateBudgetRequestStatus(ctx.orgId, id, body.status as BudgetStatus);
  return NextResponse.json({ id, status: body.status });
}
