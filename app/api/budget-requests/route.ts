import { NextRequest, NextResponse } from "next/server";
import { listBudgetRequests, createBudgetRequest, type BudgetSource } from "@/lib/db-budget";
import { getCurrentOrgId } from "@/lib/current-org";
import { getUserContext } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_SOURCES: BudgetSource[] = ["petty_cash", "direct"];

// GET /api/budget-requests?serviceId=... — all budget requests for the
// caller's org, optionally filtered to one service.
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const requests = await listBudgetRequests(orgId, serviceId);
  return NextResponse.json(requests);
}

// POST /api/budget-requests — anyone in the org can initiate one (per
// alignment doc Section 6); it defaults to the org's Budget Approver
// (see lib/db-budget.ts's getOrgBudgetApproverId) and starts `pending`.
// Approving/rejecting is a separate, gated PATCH — see [id]/route.ts.
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.source !== "string" || !VALID_SOURCES.includes(body.source as BudgetSource)) {
    return NextResponse.json({ error: "source must be 'petty_cash' or 'direct'" }, { status: 400 });
  }
  if (typeof body.purpose !== "string" || !body.purpose.trim()) {
    return NextResponse.json({ error: "purpose is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const request = await createBudgetRequest(ctx.orgId, {
    serviceId: body.serviceId,
    initiatorId: ctx.userId,
    source: body.source as BudgetSource,
    purpose: body.purpose.trim().slice(0, 2000),
    amount,
  });
  return NextResponse.json(request, { status: 201 });
}
