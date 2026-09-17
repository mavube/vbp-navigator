import { NextRequest, NextResponse } from "next/server";
import { getOrgSettings, upsertOrgSettings } from "@/lib/db-org-settings";
import { getUserContext, canManageOrgSettings, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/org-settings — org-wide visibility, same as everything else
// (a Contributor generating an invoice still needs to see the VAT rate
// and payment terms it'll carry, even though only an Org Admin can
// change them).
export async function GET() {
  const ctx = await getUserContext();
  const settings = await getOrgSettings(ctx.orgId);
  return NextResponse.json(settings);
}

// PATCH /api/org-settings — Org Admin only (see
// lib/permissions.ts's canManageOrgSettings). Full replace, not a
// partial patch, matching the "read it, edit it, write the whole thing
// back" shape the rest of this app uses for single-row-per-scope data.
export async function PATCH(req: NextRequest) {
  const ctx = await getUserContext();
  if (!canManageOrgSettings(ctx)) {
    return NextResponse.json({ error: "Only an Org Admin can change Company Settings" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  const updatedByName = await resolveDisplayName(ctx, typeof body.updatedByName === "string" ? body.updatedByName : undefined);

  const settings = await upsertOrgSettings(ctx.orgId, {
    legalName: str(body.legalName, 200),
    registrationNumber: str(body.registrationNumber, 100),
    tin: str(body.tin, 100),
    address: str(body.address, 1000),
    bankName: str(body.bankName, 200),
    bankAccountName: str(body.bankAccountName, 200),
    bankAccountNumber: str(body.bankAccountNumber, 100),
    bankBranch: str(body.bankBranch, 200),
    vatRegistered: Boolean(body.vatRegistered),
    vatNumber: str(body.vatNumber, 100),
    vatRate: Math.min(100, Math.max(0, num(body.vatRate, 0))),
    defaultCurrency: str(body.defaultCurrency, 10) || "TZS",
    paymentTermsText: str(body.paymentTermsText, 2000),
    turnstileSiteKey: str(body.turnstileSiteKey, 200),
    mailtrapFromEmail: str(body.mailtrapFromEmail, 200),
    mailtrapFromName: str(body.mailtrapFromName, 200),
    updatedByName,
  });
  return NextResponse.json(settings);
}
