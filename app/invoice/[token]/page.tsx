import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { getDocumentByAccessToken } from "@/lib/db-documents";
import { getOrgSettings } from "@/lib/db-org-settings";
import { getOrgName } from "@/lib/organizations";
import { buildDpoPaymentUrl } from "@/lib/dpo";

// Public, unauthenticated e-invoice view — Phase 14 production
// readiness, Area 1. Reached only via the opaque access_token issued
// at issue time (see app/api/commercial-documents/[id]/issue/route.ts)
// — not discoverable, not listable, no login. Works for any commercial
// document type (a customer can be sent a link to review a Proposal or
// Quotation too), but only an Invoice shows a payment section.
export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await getDocumentByAccessToken(token);
  if (!doc) notFound();

  const orgSettings = await getOrgSettings(doc.orgId);
  const orgName = await getOrgName(doc.orgId);
  const legalName = orgSettings.legalName || orgName;
  const subtotal = doc.amount ?? doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0);
  const vatAmount = orgSettings.vatRegistered ? subtotal * (orgSettings.vatRate / 100) : 0;
  const total = subtotal + vatAmount;
  const paymentUrl = doc.dpoTransToken ? buildDpoPaymentUrl(doc.dpoTransToken) : null;
  const fmt = (n: number) => `${doc.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <PublicShell orgName={legalName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{doc.docType === "invoice" ? "Invoice" : doc.docType === "quotation" ? "Quotation" : "Proposal"}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--v2-text-faint)", fontSize: "0.85rem" }}>
            {doc.documentNumber ?? doc.id.slice(0, 8)} · from {legalName}
          </p>
        </div>
        {doc.docType === "invoice" && (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: "0.75rem",
              fontWeight: 600,
              background: doc.paymentStatus === "paid" ? "var(--v2-success-bg, #dcfce7)" : "var(--v2-surface-sunken)",
              color: doc.paymentStatus === "paid" ? "#166534" : "var(--v2-text-faint)",
            }}
          >
            {doc.paymentStatus === "paid" ? "Paid" : "Unpaid"}
          </span>
        )}
      </div>

      <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--v2-text)" }}>{doc.body}</p>

      {doc.lineItems.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--v2-border)", textAlign: "left" }}>
              <th style={{ padding: "6px 4px" }}>Description</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Qty</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Unit</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--v2-border)" }}>
                <td style={{ padding: "6px 4px" }}>{item.description}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(item.unitAmount)}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(item.quantity * item.unitAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16, textAlign: "right", fontSize: "0.9rem" }}>
        <div>Subtotal: {fmt(subtotal)}</div>
        {orgSettings.vatRegistered && <div>VAT ({orgSettings.vatRate}%): {fmt(vatAmount)}</div>}
        <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: 4 }}>Total: {fmt(total)}</div>
        {doc.dueDate && <div style={{ color: "var(--v2-text-faint)", fontSize: "0.8rem", marginTop: 4 }}>Due {new Date(doc.dueDate).toLocaleDateString()}</div>}
      </div>

      {doc.docType === "invoice" && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--v2-border)" }}>
          {doc.paymentStatus === "paid" ? (
            <p style={{ color: "#166534", fontWeight: 600 }}>Payment received{doc.paidAt ? ` on ${new Date(doc.paidAt).toLocaleDateString()}` : ""}. Thank you.</p>
          ) : paymentUrl ? (
            <a
              href={paymentUrl}
              className="v2-btn v2-btn-primary"
              style={{ display: "inline-block", padding: "10px 20px", textDecoration: "none" }}
            >
              Pay Now — {fmt(total)}
            </a>
          ) : (
            <p className="v2-public-hint">A payment link isn&apos;t available yet — please use the bank details below or contact us.</p>
          )}

          {orgSettings.bankName && doc.paymentStatus !== "paid" && (
            <div style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--v2-text-faint)" }}>
              <p style={{ margin: "0 0 4px" }}>Or pay by bank transfer:</p>
              <p style={{ margin: 0 }}>{orgSettings.bankName}{orgSettings.bankBranch ? ` — ${orgSettings.bankBranch}` : ""}</p>
              {orgSettings.bankAccountName && <p style={{ margin: 0 }}>Account name: {orgSettings.bankAccountName}</p>}
              {orgSettings.bankAccountNumber && <p style={{ margin: 0 }}>Account number: {orgSettings.bankAccountNumber}</p>}
            </div>
          )}
        </div>
      )}
    </PublicShell>
  );
}
