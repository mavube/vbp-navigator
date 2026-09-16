import { NextRequest, NextResponse } from "next/server";
import { getInvoiceServiceId, updateInvoiceStatus, type InvoiceStatus } from "@/lib/db-invoices";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: InvoiceStatus[] = ["unpaid", "paid", "overdue"];

// PATCH /api/invoices/:id — mark paid/overdue. Same gate as creating
// one: that service's owner/contributor or an Org Admin.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as InvoiceStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getInvoiceServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this invoice" }, { status: 403 });
  }

  await updateInvoiceStatus(ctx.orgId, id, body.status as InvoiceStatus);
  return NextResponse.json({ id, status: body.status });
}
