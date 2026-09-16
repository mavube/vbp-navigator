import { NextRequest, NextResponse } from "next/server";
import { getCompensationEntry, finalizeCompensationEntry } from "@/lib/db-compensation";
import { getUserContext, canApproveBudget } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/compensation/:id — finalize a draft entry. This is the
// approval step (Anne, the org-wide Budget Approver, per the alignment
// doc Section 7 — "Jennifer runs, Anne approves") and it also generates
// the linked Expense that feeds this into Budget (see
// lib/db-compensation.ts's finalizeCompensationEntry). Only `{"status":
// "finalized"}` is accepted — there's no un-finalizing once the Expense
// exists.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.status !== "finalized") {
    return NextResponse.json({ error: "status must be 'finalized'" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const entry = await getCompensationEntry(ctx.orgId, id);
  if (!entry) {
    return NextResponse.json({ error: "Compensation entry not found" }, { status: 404 });
  }
  if (!canApproveBudget(ctx)) {
    return NextResponse.json({ error: "Only the org's Budget Approver can finalize a compensation entry" }, { status: 403 });
  }

  const finalized = await finalizeCompensationEntry(ctx.orgId, id);
  return NextResponse.json(finalized);
}
