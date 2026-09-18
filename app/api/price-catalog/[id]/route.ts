import { NextRequest, NextResponse } from "next/server";
import { getPriceCatalogItem, updatePriceCatalogItem } from "@/lib/db-price-catalog";
import { getUserContext, canManageOrgSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/price-catalog/:id — Org Admin only. Partial update
// (edit any subset of fields, or just flip `active` to deactivate —
// there's no DELETE: a catalog item that's already been selected into
// a document was snapshotted onto that line item at the time, so
// deactivating rather than deleting never breaks a historical document
// and is the honest way to retire a no-longer-offered item).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!canManageOrgSettings(ctx)) {
    return NextResponse.json({ error: "Only an org admin can manage the price catalog" }, { status: 403 });
  }
  const existing = await getPriceCatalogItem(ctx.orgId, id);
  if (!existing) return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const update: Parameters<typeof updatePriceCatalogItem>[2] = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim().slice(0, 200);
  if (typeof body.description === "string") update.description = body.description.trim().slice(0, 500);
  if (body.unitPrice !== undefined) {
    const unitPrice = Number(body.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "Unit price must be a non-negative number" }, { status: 400 });
    }
    update.unitPrice = unitPrice;
  }
  if (typeof body.currency === "string" && body.currency.trim()) update.currency = body.currency.trim().toUpperCase().slice(0, 10);
  if ("taxRate" in body) {
    update.taxRate = body.taxRate === null || body.taxRate === "" ? null : Math.max(0, Math.min(100, Number(body.taxRate)));
  }
  if (typeof body.active === "boolean") update.active = body.active;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) update.sortOrder = Number(body.sortOrder);

  await updatePriceCatalogItem(ctx.orgId, id, update);
  const updated = await getPriceCatalogItem(ctx.orgId, id);
  return NextResponse.json(updated);
}
