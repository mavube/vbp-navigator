import { NextRequest, NextResponse } from "next/server";
import { listPriceCatalogItems, createPriceCatalogItem } from "@/lib/db-price-catalog";
import { getOrgSettings } from "@/lib/db-org-settings";
import { getUserContext, canManageOrgSettings, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/price-catalog — every item, active and inactive (the Price
// Catalog settings page needs both; the line-item picker in a
// commercial document filters to active client-side, same "list
// everything, let the consumer decide" shape as listDocuments vs.
// listDocumentsByTypes).
export async function GET() {
  const ctx = await getUserContext();
  const items = await listPriceCatalogItems(ctx.orgId);
  return NextResponse.json(items);
}

// POST /api/price-catalog — Org Admin only, same authority as Company
// Settings (migration 0021's file comment: pricing is a company-wide
// decision, not a per-service one).
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!canManageOrgSettings(ctx)) {
    return NextResponse.json({ error: "Only an org admin can manage the price catalog" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const unitPrice = Number(body.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return NextResponse.json({ error: "Unit price must be a non-negative number" }, { status: 400 });
  }
  const orgSettings = await getOrgSettings(ctx.orgId);
  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase().slice(0, 10) : orgSettings.defaultCurrency;
  const rawTaxRate = body.taxRate;
  const taxRate = rawTaxRate === null || rawTaxRate === undefined || rawTaxRate === ""
    ? null
    : (Number.isFinite(Number(rawTaxRate)) ? Math.max(0, Math.min(100, Number(rawTaxRate))) : null);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const createdByName = await resolveDisplayName(ctx, typeof body.createdByName === "string" ? body.createdByName : undefined);

  const item = await createPriceCatalogItem(ctx.orgId, { name, description, unitPrice, currency, taxRate, createdByName });
  return NextResponse.json(item, { status: 201 });
}
