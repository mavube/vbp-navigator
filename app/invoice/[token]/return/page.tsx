import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { getDocumentByAccessToken, recordPayment, markPaymentFailed } from "@/lib/db-documents";
import { getOrgSettings } from "@/lib/db-org-settings";
import { getOrgName } from "@/lib/organizations";
import { verifyDpoToken } from "@/lib/dpo";

// Where DPO's RedirectURL points after a checkout attempt (see the
// issue route's createDpoToken call). This is the ONLY place payment
// status gets written from a customer's browser action — and even
// here, the browser's mere arrival at this page is never trusted on
// its own. verifyDpoToken is always called server-side and its result
// is what decides whether recordPayment runs — never the redirect
// itself, which could be spoofed, replayed, or hit without ever
// actually paying.
export default async function InvoiceReturnPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await getDocumentByAccessToken(token);
  if (!doc) notFound();

  const orgSettings = await getOrgSettings(doc.orgId);
  const orgName = await getOrgName(doc.orgId);
  const legalName = orgSettings.legalName || orgName;

  let heading = "Payment status";
  let message = "We couldn't check this payment right now — please try refreshing, or contact us if this continues.";
  let tone: "success" | "pending" | "failed" = "pending";

  if (doc.paymentStatus === "paid") {
    heading = "Payment received";
    message = "Thank you — this invoice is already marked paid.";
    tone = "success";
  } else if (doc.dpoTransToken) {
    try {
      const result = await verifyDpoToken(doc.dpoTransToken);
      if (result.paid) {
        await recordPayment(doc.orgId, doc.id);
        heading = "Payment received";
        message = "Thank you — we've confirmed your payment.";
        tone = "success";
      } else if (result.pending) {
        heading = "Payment pending";
        message = "We haven't received confirmation of this payment yet. If you just completed checkout, please wait a moment and refresh this page.";
        tone = "pending";
      } else {
        await markPaymentFailed(doc.orgId, doc.id);
        heading = "Payment not completed";
        message = result.resultExplanation || "The payment wasn't completed. You can try again from the invoice page.";
        tone = "failed";
      }
    } catch {
      // Leave the default "couldn't check" message — never guess at a
      // payment outcome when DPO couldn't be reached.
    }
  } else {
    heading = "No payment on file";
    message = "This invoice doesn't have a payment link set up. Please use the bank details on the invoice or contact us directly.";
    tone = "failed";
  }

  return (
    <PublicShell orgName={legalName}>
      <h1 style={{ margin: "0 0 8px", fontSize: "1.3rem", color: tone === "success" ? "#166534" : tone === "failed" ? "var(--v2-danger)" : undefined }}>
        {heading}
      </h1>
      <p style={{ color: "var(--v2-text)" }}>{message}</p>
      <Link href={`/invoice/${token}`} className="v2-btn v2-btn-secondary" style={{ display: "inline-block", marginTop: 12, padding: "8px 16px", textDecoration: "none" }}>
        Back to invoice
      </Link>
    </PublicShell>
  );
}
