import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "@/lib/db-documents";
import { getOrgSettings } from "@/lib/db-org-settings";
import { getOrgName } from "@/lib/organizations";
import { renderCommercialDocumentPdf } from "@/lib/pdf-commercial";
import { buildDpoPaymentUrl } from "@/lib/dpo";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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

// GET /api/commercial-documents/:id/pdf — staff-facing preview/download
// at any stage (including draft, so it can be checked before issuing).
// Same visibility gate as managing the document itself.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const doc = await getDocument(ctx.orgId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!canManageService(ctx, doc.serviceId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const orgSettings = await getOrgSettings(ctx.orgId);
  const orgName = await getOrgName(ctx.orgId);
  const paymentUrl = doc.dpoTransToken ? buildDpoPaymentUrl(doc.dpoTransToken) : null;
  const logoBytes = await loadLogoBytes();

  const pdfBytes = await renderCommercialDocumentPdf(doc, orgSettings, orgName, { paymentUrl, logoBytes });
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(doc.documentNumber || doc.docType).replace(/[^a-zA-Z0-9-]/g, "_")}.pdf"`,
    },
  });
}
