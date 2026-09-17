import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getDocument, advanceDocumentStatus } from "@/lib/db-documents";
import { getOrgSettings } from "@/lib/db-org-settings";
import { getOrgName } from "@/lib/organizations";
import { renderCommercialDocumentPdf } from "@/lib/pdf-commercial";
import { buildDpoPaymentUrl } from "@/lib/dpo";
import { isMailtrapConfigured, sendEmail } from "@/lib/mailtrap";
import { logEmail } from "@/lib/db-email-log";
import { getUserContext, canManageService, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Drop a file at public/gdc-logo.png (or .jpg) and it's picked up here
// automatically — no code change needed. Until then, PDFs render with
// a text-only header (see lib/pdf-commercial.ts).
async function loadLogoBytes(): Promise<Uint8Array | null> {
  for (const name of ["gdc-logo.png", "gdc-logo.jpg", "gdc-logo.jpeg"]) {
    try {
      const buf = await readFile(path.join(process.cwd(), "public", name));
      return new Uint8Array(buf);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// POST /api/commercial-documents/:id/send — issued -> sent. Generates
// the real PDF, sends it via Mailtrap (with, for an invoice, the
// e-invoice link in the body as a link-only alternative to the PDF
// attachment — Diallo: "send a pdf invoice embedding payment link or
// simply send e-invoice... with the payment link"), and logs the
// attempt to email_log regardless of outcome. Only a genuine Mailtrap
// success ("sent" logged, provider message id captured) moves the
// document to 'sent' — a failed send leaves it at 'issued' so it's
// visibly still unsent, never silently marked as if it went out.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!["issued", "sent"].includes(doc.status)) {
    return NextResponse.json({ error: "Only an issued document can be sent (or re-sent)" }, { status: 400 });
  }
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!doc.recipientEmail) return NextResponse.json({ error: "This document has no recipient email on file" }, { status: 400 });
  if (!isMailtrapConfigured()) return NextResponse.json({ error: "Mailtrap isn't configured (MAILTRAP_API_TOKEN missing) — can't send real email yet" }, { status: 503 });

  const orgSettings = await getOrgSettings(ctx.orgId);
  if (!orgSettings.mailtrapFromEmail) {
    return NextResponse.json({ error: "No sending address set — add one in Company Settings before sending email" }, { status: 400 });
  }
  const orgName = await getOrgName(ctx.orgId);
  const requestBody = await req.json().catch(() => ({}));
  const sentByName = await resolveDisplayName(ctx, typeof requestBody.sentByName === "string" ? requestBody.sentByName : undefined);

  const paymentUrl = doc.dpoTransToken ? buildDpoPaymentUrl(doc.dpoTransToken) : null;
  const logoBytes = await loadLogoBytes();

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderCommercialDocumentPdf(doc, orgSettings, orgName, { paymentUrl, logoBytes });
  } catch (err) {
    return NextResponse.json({ error: `Couldn't generate the PDF: ${err instanceof Error ? err.message : "unknown error"}` }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const viewLink = doc.accessToken ? `${origin}/invoice/${doc.accessToken}` : null;
  const linkLine = doc.docType === "invoice" && viewLink
    ? `\n\nView and pay this invoice online: ${viewLink}`
    : viewLink
    ? `\n\nView this document online: ${viewLink}`
    : "";

  const result = await sendEmail({
    to: doc.recipientEmail,
    subject: doc.title,
    text: `${doc.body}${linkLine}`,
    fromEmail: orgSettings.mailtrapFromEmail,
    fromName: orgSettings.mailtrapFromName || orgName,
    attachments: [
      {
        filename: `${doc.documentNumber || doc.docType}.pdf`,
        contentBase64: Buffer.from(pdfBytes).toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });

  await logEmail(ctx.orgId, {
    documentId: doc.id,
    toEmail: doc.recipientEmail,
    subject: doc.title,
    provider: "mailtrap",
    providerMessageId: result.messageId,
    status: result.ok ? "sent" : "failed",
    errorMessage: result.error,
    sentByName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Mailtrap couldn't send this email: ${result.error}` }, { status: 502 });
  }

  if (doc.status !== "sent") {
    await advanceDocumentStatus(ctx.orgId, id, "sent");
  }
  const updated = await getDocument(ctx.orgId, id);
  return NextResponse.json({ document: updated, messageId: result.messageId });
}
