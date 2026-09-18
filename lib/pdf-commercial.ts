// Renders a Proposal/Quotation/Invoice document row into a real PDF —
// Phase 14 production readiness, Area 1. Uses pdf-lib (pure JS, no
// native binary, works on Vercel's serverless runtime) rather than a
// headless-Chrome approach (Puppeteer) — this app has no existing PDF
// infrastructure to build on, and pdf-lib is the lighter, more
// serverless-friendly choice for a layout this straightforward
// (header, a line-item table, totals, a footer).
//
// The GDC logo itself is NOT embedded — Diallo has the image file but
// hasn't uploaded it into this build yet. Pass a PNG/JPEG buffer via
// `logoBytes` once it's available (e.g. read from public/logo.png) and
// it renders top-left; until then the header falls back to the legal
// name as plain text, which is still a real, correctly-branded
// document — just without the mark.
//
// Every figure on this PDF comes from the document row itself
// (line items, amount, currency) or org_settings (legal/bank/VAT
// details) — nothing here is invented or hardcoded per the directive's
// "no hardcoded business logic" rule.

import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from "pdf-lib";
import type { DocumentRow } from "@/lib/db-documents";
import type { OrgSettings } from "@/lib/db-org-settings";

function addLinkAnnotation(page: import("pdf-lib").PDFPage, opts: { x: number; y: number; width: number; height: number; url: string }) {
  // pdf-lib has no first-class "add a clickable link" helper as of the
  // version pinned in package.json — this is the documented low-level
  // recipe (a /Link annotation with a /URI action) using only pdf-lib's
  // stable public context APIs. If anything about this ever silently
  // fails to produce a clickable region, the visible URL text this
  // module always prints alongside it (see renderInvoicePaymentBlock)
  // is still there as a working fallback — the PDF is never useless
  // without it.
  const doc = page.doc;
  const annotation = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [opts.x, opts.y, opts.x + opts.width, opts.y + opts.height],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(opts.url) },
  });
  const ref = doc.context.register(annotation);
  const existing = page.node.lookup(PDFName.of("Annots"));
  if (existing) {
    (existing as import("pdf-lib").PDFArray).push(ref);
  } else {
    page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
  }
}

function fmtMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

const DOC_TYPE_HEADING: Record<string, string> = { proposal: "PROPOSAL", quotation: "QUOTATION", invoice: "INVOICE" };

export async function renderCommercialDocumentPdf(
  doc: DocumentRow,
  orgSettings: OrgSettings,
  orgName: string,
  opts?: { paymentUrl?: string | null; logoBytes?: Uint8Array | null }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const legalName = orgSettings.legalName || orgName;

  if (opts?.logoBytes) {
    try {
      const isPng = opts.logoBytes[0] === 0x89;
      const image = isPng ? await pdf.embedPng(opts.logoBytes) : await pdf.embedJpg(opts.logoBytes);
      const logoHeight = 40;
      const logoWidth = (image.width / image.height) * logoHeight;
      page.drawImage(image, { x: margin, y: y - logoHeight, width: logoWidth, height: logoHeight });
    } catch {
      // Malformed or unsupported image bytes — fall through to the
      // text-only header rather than failing the whole PDF.
      page.drawText(legalName, { x: margin, y: y - 20, size: 16, font: fontBold });
    }
  } else {
    page.drawText(legalName, { x: margin, y: y - 20, size: 16, font: fontBold });
  }

  const heading = DOC_TYPE_HEADING[doc.docType] ?? doc.docType.toUpperCase();
  page.drawText(heading, { x: width - margin - fontBold.widthOfTextAtSize(heading, 20), y: y - 20, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.4) });
  y -= 50;

  const docNumberLine = doc.documentNumber ? `No. ${doc.documentNumber}` : `Ref. ${doc.id.slice(0, 8)}`;
  page.drawText(docNumberLine, { x: width - margin - font.widthOfTextAtSize(docNumberLine, 10), y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 14;
  const dateLine = `Date: ${fmtDate(doc.issuedAt || doc.createdAt)}`;
  page.drawText(dateLine, { x: width - margin - font.widthOfTextAtSize(dateLine, 10), y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  if (doc.dueDate) {
    y -= 14;
    const dueLine = `Due: ${fmtDate(doc.dueDate)}`;
    page.drawText(dueLine, { x: width - margin - font.widthOfTextAtSize(dueLine, 10), y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  }
  y -= 28;

  // Org legal block (left) — everything here comes from Company
  // Settings, never hardcoded.
  const orgLines = [
    legalName,
    orgSettings.address,
    orgSettings.registrationNumber ? `Reg. No: ${orgSettings.registrationNumber}` : "",
    orgSettings.tin ? `TIN: ${orgSettings.tin}` : "",
    orgSettings.vatRegistered && orgSettings.vatNumber ? `VAT No: ${orgSettings.vatNumber}` : "",
  ].filter(Boolean);
  let leftY = y;
  for (const line of orgLines) {
    page.drawText(line, { x: margin, y: leftY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    leftY -= 12;
  }

  // Recipient block (right)
  const billToLabel = "Bill To:";
  page.drawText(billToLabel, { x: width / 2 + 20, y, size: 9, font: fontBold });
  let rightY = y - 12;
  for (const line of [doc.recipientName, doc.recipientEmail].filter(Boolean)) {
    page.drawText(line, { x: width / 2 + 20, y: rightY, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    rightY -= 12;
  }
  y = Math.min(leftY, rightY) - 20;

  // Cover note (the templated body text)
  const bodyLines = doc.body.split("\n").filter((l) => l.trim().length > 0).slice(0, 6);
  for (const line of bodyLines) {
    const wrapped = wrapText(line, font, 10, width - margin * 2);
    for (const w of wrapped) {
      page.drawText(w, { x: margin, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 13;
    }
  }
  y -= 10;

  // Line items table
  if (doc.lineItems.length > 0) {
    const colDesc = margin;
    const colQty = width - margin - 220;
    const colUnit = width - margin - 150;
    const colTotal = width - margin - 60;

    page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 18, color: rgb(0.93, 0.93, 0.96) });
    page.drawText("Description", { x: colDesc + 4, y, size: 9, font: fontBold });
    page.drawText("Qty", { x: colQty, y, size: 9, font: fontBold });
    page.drawText("Unit", { x: colUnit, y, size: 9, font: fontBold });
    page.drawText("Amount", { x: colTotal, y, size: 9, font: fontBold });
    y -= 22;

    for (const item of doc.lineItems) {
      const wrapped = wrapText(item.description, font, 9, colQty - colDesc - 10);
      for (let i = 0; i < wrapped.length; i++) {
        page.drawText(wrapped[i], { x: colDesc + 4, y, size: 9, font });
        if (i === 0) {
          page.drawText(String(item.quantity), { x: colQty, y, size: 9, font });
          page.drawText(fmtMoney(item.unitAmount, doc.currency), { x: colUnit, y, size: 9, font });
          page.drawText(fmtMoney(item.quantity * item.unitAmount, doc.currency), { x: colTotal, y, size: 9, font });
        }
        y -= 13;
      }
    }
    y -= 8;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 18;
  }

  // Totals. Phase 15: tax is computed per line item — each item's
  // unitAmount is always tax-exclusive, and its taxRate was snapshotted
  // at selection time (see lib/db-price-catalog.ts and
  // lib/db-documents.ts's DocumentLineItem comment). A document with no
  // line items at all (a flat headline amount, e.g. a quick phone-order
  // invoice with no itemization) falls back to the org's current VAT
  // rate applied once — the same behavior this PDF always had — since
  // there's nothing itemized to carry a per-item rate.
  const subtotal = doc.amount ?? doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0);
  const taxAmount = doc.lineItems.length > 0
    ? doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount * ((i.taxRate ?? 0) / 100), 0)
    : (orgSettings.vatRegistered ? subtotal * (orgSettings.vatRate / 100) : 0);
  const total = subtotal + taxAmount;

  const totalsX = width - margin - 160;
  page.drawText("Subtotal", { x: totalsX, y, size: 10, font });
  page.drawText(fmtMoney(subtotal, doc.currency), { x: width - margin - font.widthOfTextAtSize(fmtMoney(subtotal, doc.currency), 10), y, size: 10, font });
  y -= 14;
  if (taxAmount > 0) {
    page.drawText("Tax", { x: totalsX, y, size: 10, font });
    page.drawText(fmtMoney(taxAmount, doc.currency), { x: width - margin - font.widthOfTextAtSize(fmtMoney(taxAmount, doc.currency), 10), y, size: 10, font });
    y -= 14;
  }
  page.drawText("Total Due", { x: totalsX, y, size: 12, font: fontBold });
  const totalStr = fmtMoney(total, doc.currency);
  page.drawText(totalStr, { x: width - margin - fontBold.widthOfTextAtSize(totalStr, 12), y, size: 12, font: fontBold });
  y -= 30;

  // Payment block — invoice only, and only once issued with a real DPO
  // link. Prints the URL as visible text (always works) and attempts a
  // clickable annotation over it (see addLinkAnnotation's own comment).
  if (doc.docType === "invoice" && opts?.paymentUrl) {
    page.drawRectangle({ x: margin, y: y - 30, width: 200, height: 26, color: rgb(0.13, 0.45, 0.28) });
    page.drawText("Pay Now", { x: margin + 16, y: y - 21, size: 11, font: fontBold, color: rgb(1, 1, 1) });
    addLinkAnnotation(page, { x: margin, y: y - 30, width: 200, height: 26, url: opts.paymentUrl });
    y -= 40;
    page.drawText(opts.paymentUrl, { x: margin, y, size: 8, font, color: rgb(0.2, 0.4, 0.8) });
    addLinkAnnotation(page, { x: margin, y: y - 2, width: font.widthOfTextAtSize(opts.paymentUrl, 8), height: 10, url: opts.paymentUrl });
    y -= 24;
  }

  // Bank details fallback — always shown on an invoice when set, since
  // not every customer pays by card/mobile money through DPO.
  if (doc.docType === "invoice" && orgSettings.bankName) {
    const bankLines = [
      "Or pay by bank transfer:",
      `${orgSettings.bankName}${orgSettings.bankBranch ? ` — ${orgSettings.bankBranch}` : ""}`,
      orgSettings.bankAccountName ? `Account name: ${orgSettings.bankAccountName}` : "",
      orgSettings.bankAccountNumber ? `Account number: ${orgSettings.bankAccountNumber}` : "",
    ].filter(Boolean);
    for (const line of bankLines) {
      page.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 12;
    }
    y -= 8;
  }

  if (orgSettings.paymentTermsText) {
    const wrapped = wrapText(orgSettings.paymentTermsText, font, 8, width - margin * 2);
    for (const w of wrapped) {
      page.drawText(w, { x: margin, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 11;
    }
  }

  return pdf.save();
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
