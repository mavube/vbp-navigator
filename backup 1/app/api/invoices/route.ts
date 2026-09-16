import { NextRequest, NextResponse } from "next/server";
import { listInvoices, createInvoice, type InvoiceDirection } from "@/lib/db-invoices";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_DIRECTIONS: InvoiceDirection[] = ["incoming", "outgoing"];

// GET /api/invoices?serviceId=...&direction=incoming|outgoing
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const directionParam = req.nextUrl.searchParams.get("direction");
  const direction = directionParam && VALID_DIRECTIONS.includes(directionParam as InvoiceDirection)
    ? (directionParam as InvoiceDirection)
    : undefined;
  const invoices = await listInvoices(ctx.orgId, serviceId, direction);
  return NextResponse.json(invoices);
}

// POST /api/invoices — incoming (a vendor's bill to VBP, tied to an
// Expense) or outgoing (VBP billing a customer, tied to a Class/Lead —
// no approval chain either way, per the alignment doc Section 6).
// Gated the same as Expenses: that service's owner/contributor or an
// Org Admin.
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.direction !== "string" || !VALID_DIRECTIONS.includes(body.direction as InvoiceDirection)) {
    return NextResponse.json({ error: "direction must be 'incoming' or 'outgoing'" }, { status: 400 });
  }
  if (typeof body.party !== "string" || !body.party.trim()) {
    return NextResponse.json({ error: "party is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }
  if (!canManageService(ctx, body.serviceId)) {
    return NextResponse.json({ error: "Not allowed to issue an invoice against this service" }, { status: 403 });
  }

  const invoice = await createInvoice(ctx.orgId, {
    serviceId: body.serviceId,
    direction: body.direction as InvoiceDirection,
    party: body.party.trim().slice(0, 200),
    amount,
    expenseId: typeof body.expenseId === "string" ? body.expenseId : null,
    classId: typeof body.classId === "string" ? body.classId : null,
    leadId: typeof body.leadId === "string" ? body.leadId : null,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
  });
  return NextResponse.json(invoice, { status: 201 });
}
