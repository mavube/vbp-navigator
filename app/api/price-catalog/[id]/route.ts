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

  // Phase 16 (Products & Services Catalog) — same optional offering-
  // definition fields as POST; only touched when present in the body,
  // same partial-update discipline as everything else here.
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  if (typeof body.category === "string") update.category = str(body.category, 100);
  if (typeof body.offeringType === "string") update.offeringType = str(body.offeringType, 100);
  if (typeof body.targetCustomer === "string") update.targetCustomer = str(body.targetCustomer, 300);
  if (typeof body.standardOffering === "string") update.standardOffering = str(body.standardOffering, 1000);
  if (typeof body.deliveryModel === "string") update.deliveryModel = str(body.deliveryModel, 200);
  if (typeof body.typicalDuration === "string") update.typicalDuration = str(body.typicalDuration, 100);
  if (typeof body.pricingModel === "string") update.pricingModel = str(body.pricingModel, 200);
  if (typeof body.included === "string") update.included = str(body.included, 1000);
  if (typeof body.expectedOutcome === "string") update.expectedOutcome = str(body.expectedOutcome, 1000);
  if (typeof body.relatedDocuments === "string") update.relatedDocuments = str(body.relatedDocuments, 500);
  if (Array.isArray(body.requiredCapabilities)) {
    update.requiredCapabilities = body.requiredCapabilities.filter((x: unknown): x is string => typeof x === "string");
  }

  await updatePriceCatalogItem(ctx.orgId, id, update);
  const updated = await getPriceCatalogItem(ctx.orgId, id);
  return NextResponse.json(updated);
}
