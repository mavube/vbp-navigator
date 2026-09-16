import { NextRequest, NextResponse } from "next/server";
import { listExpenses, createExpense } from "@/lib/db-expenses";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/expenses?serviceId=... — all recorded spend for the
// caller's org, optionally filtered to one service.
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const expenses = await listExpenses(ctx.orgId, serviceId);
  return NextResponse.json(expenses);
}

// POST /api/expenses — record actual spend. Unlike a Budget Request
// (anyone can initiate), logging a real Expense is restricted to that
// service's owner/contributor or an Org Admin — it's a cash outlay
// being recorded, not a request for one.
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }
  if (!canManageService(ctx, body.serviceId)) {
    return NextResponse.json({ error: "Not allowed to log an expense against this service" }, { status: 403 });
  }

  const expense = await createExpense(ctx.orgId, {
    serviceId: body.serviceId,
    budgetRequestId: typeof body.budgetRequestId === "string" ? body.budgetRequestId : null,
    amount,
    expenseDate: typeof body.expenseDate === "string" ? body.expenseDate : undefined,
    description: typeof body.description === "string" ? body.description.slice(0, 2000) : undefined,
    receiptUrl: typeof body.receiptUrl === "string" ? body.receiptUrl.slice(0, 2000) : undefined,
  });
  return NextResponse.json(expense, { status: 201 });
}
