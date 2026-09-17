import { NextRequest, NextResponse } from "next/server";
import { listInvoices, createInvoice, type InvoiceDirection, type InvoiceLineItem } from "@/lib/db-invoices";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_DIRECTIONS: InvoiceDirection[] = ["incoming", "outgoing"];
const MAX_LINE_ITEMS = 20;

// v3.0 roadmap Phase 10 (Cluster C) — validates and normalizes a
// client-sent lineItems array. Every figure here is still staff-typed
// (a description, a quantity, a unit amount) — this only checks shape
// and sums it, the same "never invent a number" discipline every other
// money feature in this app follows. Returns null (not an empty array)
// when the input isn't a usable array, so the caller can tell "no line
// items given" apart from "line items given but invalid."
function parseLineItems(body: unknown): InvoiceLineItem[] | null {
  if (!Array.isArray(body)) return null;
  const items: InvoiceLineItem[] = [];
  for (const raw of body.slice(0, MAX_LINE_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const rawItem = raw as Record<string, unknown>;
    const description = typeof rawItem.description === "string" ? rawItem.description.trim().slice(0, 200) : "";
    const quantity = Number(rawItem.quantity);
    const unitAmount = Number(rawItem.unitAmount);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitAmount) || unitAmount < 0) {
      continue;
    }
    items.push({ description, quantity, unitAmount });
  }
  return items;
}

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

  // Line items, when given, are the source of truth for the total — a
  // client-sent flat `amount` alongside them is ignored rather than
  // trusted, so the two can never silently disagree. No line items
  // given (null) falls back to the flat `amount` field exactly as
  // before this phase.
  const lineItems = parseLineItems(body.lineItems);
  let amount: number;
  if (lineItems && lineItems.length > 0) {
    amount = lineItems.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);
  } else {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }
  }
  if (!canManageService(ctx, body.serviceId)) {
    return NextResponse.json({ error: "Not allowed to issue an invoice against this service" }, { status: 403 });
  }

  const invoice = await createInvoice(ctx.orgId, {
    serviceId: body.serviceId,
    direction: body.direction as InvoiceDirection,
    party: body.party.trim().slice(0, 200),
    amount,
    lineItems: lineItems ?? [],
    expenseId: typeof body.expenseId === "string" ? body.expenseId : null,
    classId: typeof body.classId === "string" ? body.classId : null,
    leadId: typeof body.leadId === "string" ? body.leadId : null,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
  });
  return NextResponse.json(invoice, { status: 201 });
}
