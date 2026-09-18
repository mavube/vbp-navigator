import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDocument, advanceDocumentStatus, recordDpoToken } from "@/lib/db-documents";
import { getOrgSettings } from "@/lib/db-org-settings";
import { isDpoConfigured, createDpoToken } from "@/lib/dpo";
import { getUserContext, canManageService, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const DOC_PREFIX: Record<string, string> = { proposal: "PRO", quotation: "QTN", invoice: "INV" };

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// POST /api/commercial-documents/:id/issue — approved -> issued. This
// is the moment a commercial document becomes a real, numbered,
// externally-referenceable artifact: it gets a document number and an
// access token (the e-invoice/view link's only credential — see
// lib/db-documents.ts's getDocumentByAccessToken). For an invoice, if
// DPO is configured, this is also where the DPO transaction is created
// — once, here, not on every page view — so the payment link on the
// PDF and the e-invoice page are stable for the life of the invoice.
//
// Gated the same as day-to-day document management (that service's
// owner/contributor or an org admin) — the money decision already
// happened at the approve step; issuing is operational, not a second
// approval.
//
// A DPO failure here never blocks issuing — a real invoice with a
// payment problem is still a real invoice (bank-transfer details still
// print on the PDF as a fallback); the response's `warning` field
// surfaces what went wrong so staff can retry or fix it by hand.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status !== "approved") {
    return NextResponse.json({ error: "Only an approved document can be issued" }, { status: 400 });
  }
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const issuedByName = await resolveDisplayName(ctx, typeof body.issuedByName === "string" ? body.issuedByName : undefined);

  const documentNumber = `${DOC_PREFIX[doc.docType] ?? "DOC"}-${monthKey()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const accessToken = randomBytes(24).toString("hex");

  // Phase 15 fix: the amount DPO charges must be the same total the
  // customer sees on the PDF/e-invoice page ("Total Due" = subtotal +
  // tax) — never just the tax-exclusive subtotal. Same per-item tax
  // computation as lib/pdf-commercial.ts and app/invoice/[token]/page.tsx.
  const subtotal = doc.amount ?? doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0);
  let totalDue = subtotal;
  if (doc.docType === "invoice" && subtotal > 0) {
    if (doc.lineItems.length > 0) {
      const taxTotal = doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount * ((i.taxRate ?? 0) / 100), 0);
      totalDue = subtotal + taxTotal;
    } else {
      const orgSettings = await getOrgSettings(ctx.orgId);
      totalDue = orgSettings.vatRegistered ? subtotal * (1 + orgSettings.vatRate / 100) : subtotal;
    }
  }

  let dpoWarning: string | null = null;
  if (doc.docType === "invoice" && totalDue > 0) {
    if (isDpoConfigured()) {
      try {
        const origin = new URL(req.url).origin;
        const result = await createDpoToken({
          amount: totalDue,
          currency: doc.currency,
          companyRef: doc.id,
          redirectUrl: `${origin}/invoice/${accessToken}/return`,
          backUrl: `${origin}/invoice/${accessToken}`,
          serviceDescription: doc.title.slice(0, 100),
          customerEmail: doc.recipientEmail,
          customerFirstName: doc.recipientName.split(" ")[0] || doc.recipientName,
          customerLastName: doc.recipientName.split(" ").slice(1).join(" ") || doc.recipientName,
        });
        if (result.ok && result.transToken) {
          await recordDpoToken(ctx.orgId, id, { dpoTransToken: result.transToken, dpoTransRef: result.transRef, dpoCompanyRef: doc.id });
        } else {
          dpoWarning = `DPO didn't return a usable payment token (${result.resultCode ?? "no result code"}: ${result.resultExplanation ?? "unknown"}). The invoice was still issued — add a payment link manually or retry.`;
        }
      } catch (err) {
        dpoWarning = `Couldn't reach DPO to create a payment link (${err instanceof Error ? err.message : "unknown error"}). The invoice was still issued — bank details still show on the PDF.`;
      }
    } else {
      dpoWarning = "DPO isn't configured yet — issued without a payment link. Bank details (if set in Company Settings) still show on the PDF.";
    }
  }

  await advanceDocumentStatus(ctx.orgId, id, "issued", { issuedByName, documentNumber, accessToken });
  const updated = await getDocument(ctx.orgId, id);
  return NextResponse.json({ document: updated, warning: dpoWarning });
}
