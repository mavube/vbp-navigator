"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { isOverdueInvoice, daysOverdue, isStalledDocument, daysSince } from "@/lib/commercial-doc-signals";
import type { CommercialDocument, CommercialStatus, CommercialDocType } from "@/components/commercial/types";

const TYPE_LABELS: Record<CommercialDocType, string> = { proposal: "Proposal", quotation: "Quotation", invoice: "Invoice" };
const STATUS_LABEL: Record<CommercialStatus, string> = {
  draft: "Draft",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  issued: "Issued",
  sent: "Sent",
  delivered: "Delivered",
  acknowledged: "Acknowledged",
};
const STATUS_TONE: Record<CommercialStatus, "neutral" | "accent" | "success" | "danger"> = {
  draft: "neutral",
  under_review: "accent",
  approved: "success",
  rejected: "danger",
  issued: "accent",
  sent: "accent",
  delivered: "success",
  acknowledged: "success",
};

// Which document type a given one can be converted INTO via the
// generic mechanism. Phase 15 correction (Diallo's "case 1"): a
// Proposal can no longer convert directly into anything — its prose
// content doesn't map onto structured line items the way a Quotation's
// already-structured items do. Only a Quotation converts to an
// Invoice. A Proposal's own path to an Invoice is "Mark accepted" then
// "Create Invoice from Proposal", below — a different action, not this
// generic selector.
const CONVERT_TARGETS: Record<CommercialDocType, CommercialDocType[]> = {
  proposal: [],
  quotation: ["invoice"],
  invoice: [],
};

type ActionName =
  | "submit" | "approve" | "reject" | "reopen" | "mark_acknowledged" | "issue" | "send" | "convert"
  | "mark_accepted" | "invoice_from_proposal";

export function CommercialDocumentItem({
  doc,
  onChange,
  onConverted,
}: {
  doc: CommercialDocument;
  onChange: (updated: CommercialDocument) => void;
  onConverted: (doc: CommercialDocument) => void;
}) {
  const [pending, setPending] = useState<ActionName | null>(null);
  const busy = pending !== null;
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [convertTo, setConvertTo] = useState<CommercialDocType>(CONVERT_TARGETS[doc.docType][0] ?? "invoice");

  async function call(path: string, body: Record<string, unknown>, name: ActionName): Promise<Record<string, unknown> | null> {
    setError("");
    setWarning("");
    setPending(name);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
      return null;
    } finally {
      setPending(null);
    }
  }

  async function lifecycle(action: string, name: ActionName) {
    const data = await call(`/api/commercial-documents/${doc.id}`, { action }, name);
    if (data) onChange(data as unknown as CommercialDocument);
  }
  async function issue() {
    const data = await call(`/api/commercial-documents/${doc.id}/issue`, {}, "issue");
    if (data) {
      onChange(data.document as CommercialDocument);
      if (data.warning) setWarning(data.warning as string);
    }
  }
  async function send() {
    const data = await call(`/api/commercial-documents/${doc.id}/send`, {}, "send");
    if (data) onChange(data.document as CommercialDocument);
  }
  async function convert() {
    const data = await call("/api/commercial-documents", { parentDocumentId: doc.id, docType: convertTo }, "convert");
    if (data) onConverted(data as unknown as CommercialDocument);
  }
  async function markAccepted() {
    const data = await call(`/api/commercial-documents/${doc.id}`, { action: "mark_accepted" }, "mark_accepted");
    if (data) onChange(data as unknown as CommercialDocument);
  }
  async function invoiceFromProposal() {
    const data = await call("/api/commercial-documents", { fromAcceptedProposalId: doc.id, docType: "invoice" }, "invoice_from_proposal");
    if (data) onConverted(data as unknown as CommercialDocument);
  }

  const subtotal = doc.amount ?? doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0);
  const taxTotal = doc.lineItems.reduce((sum, i) => sum + i.quantity * i.unitAmount * ((i.taxRate ?? 0) / 100), 0);
  const total = subtotal + taxTotal;
  const [expanded, setExpanded] = useState(false);

  // Post-Phase-G, third confirmed next step — see
  // lib/commercial-doc-signals.ts for what these mean and why. Overdue
  // takes priority when both are somehow true (an invoice can't be
  // "stalled" the same way a proposal/quotation can, since it isn't
  // waiting on a yes/no).
  const overdue = isOverdueInvoice(doc);
  const stalled = !overdue && isStalledDocument(doc);

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{doc.title}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {doc.documentNumber ? `${doc.documentNumber} · ` : ""}
            {doc.recipientName}
            {doc.recipientEmail ? ` · ${doc.recipientEmail}` : ""}
            {doc.lineItems.length > 0 || doc.amount ? ` · ${doc.currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="neutral">{TYPE_LABELS[doc.docType]}</Badge>
          <Badge tone={STATUS_TONE[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
          {doc.docType === "invoice" && doc.paymentStatus !== "not_applicable" && (
            <Badge tone={doc.paymentStatus === "paid" ? "success" : doc.paymentStatus === "failed" ? "danger" : "neutral"}>
              {doc.paymentStatus === "paid" ? "Paid" : doc.paymentStatus === "failed" ? "Payment failed" : "Unpaid"}
            </Badge>
          )}
          {overdue && <Badge tone="danger">Overdue {daysOverdue(doc.dueDate as string)}d</Badge>}
          {stalled && <Badge tone="warning">No response {daysSince(doc.sentAt as string)}d</Badge>}
        </div>
      </div>

      <button type="button" onClick={() => setExpanded((v) => !v)} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem", marginTop: "var(--v2-space-3)" }}>
        {expanded ? "Hide details" : "View details"}
      </button>

      {expanded && (
        <div style={{ marginTop: "var(--v2-space-3)", fontSize: "0.85rem" }}>
          <p style={{ whiteSpace: "pre-wrap" }}>{doc.body}</p>
          {doc.lineItems.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <tbody>
                {doc.lineItems.map((item, i) => {
                  const lineSubtotal = item.quantity * item.unitAmount;
                  const lineTax = lineSubtotal * ((item.taxRate ?? 0) / 100);
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--v2-border)" }}>
                      <td style={{ padding: "4px 0" }}>{item.description}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right" }}>{item.quantity} × {doc.currency} {item.unitAmount.toLocaleString()}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", color: "var(--v2-text-faint)" }}>
                        {item.taxRate ? `+${item.taxRate}% tax` : "no tax"}
                      </td>
                      <td style={{ padding: "4px 0", textAlign: "right" }}>{doc.currency} {(lineSubtotal + lineTax).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {doc.accessToken && (
            <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
              <a href={`/api/commercial-documents/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--v2-accent)" }}>View PDF</a>
              <a href={`/invoice/${doc.accessToken}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--v2-accent)" }}>Customer link</a>
            </div>
          )}
          {!doc.accessToken && ["draft", "under_review", "approved"].includes(doc.status) && (
            <div style={{ marginTop: 8 }}>
              <a href={`/api/commercial-documents/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--v2-accent)" }}>Preview PDF</a>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "var(--v2-space-3)", display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "center" }}>
        {doc.status === "draft" && (
          <ActionButton label="Submit for review" busyLabel="Submitting…" busy={pending === "submit"} disabled={busy} onClick={() => lifecycle("submit", "submit")} primary />
        )}
        {doc.status === "under_review" && (
          <>
            <ActionButton label="Approve" busyLabel="Approving…" busy={pending === "approve"} disabled={busy} onClick={() => lifecycle("approve", "approve")} primary />
            <ActionButton label="Reject" busyLabel="Rejecting…" busy={pending === "reject"} disabled={busy} onClick={() => lifecycle("reject", "reject")} />
          </>
        )}
        {doc.status === "rejected" && (
          <ActionButton label="Reopen as draft" busyLabel="Reopening…" busy={pending === "reopen"} disabled={busy} onClick={() => lifecycle("reopen", "reopen")} />
        )}
        {doc.status === "approved" && (
          <ActionButton label="Issue" busyLabel="Issuing…" busy={pending === "issue"} disabled={busy} onClick={issue} primary />
        )}
        {(doc.status === "issued" || doc.status === "sent") && (
          <ActionButton
            label={doc.status === "sent" ? "Re-send email" : "Send email"}
            busyLabel="Sending…"
            busy={pending === "send"}
            disabled={busy}
            onClick={send}
            primary={doc.status === "issued"}
          />
        )}
        {["sent", "delivered"].includes(doc.status) && doc.docType !== "invoice" && (
          <ActionButton label="Mark acknowledged" busyLabel="Marking…" busy={pending === "mark_acknowledged"} disabled={busy} onClick={() => lifecycle("mark_acknowledged", "mark_acknowledged")} />
        )}
        {doc.docType === "proposal" && !doc.acceptedAt && ["approved", "issued", "sent", "delivered"].includes(doc.status) && (
          <ActionButton label="Mark accepted" busyLabel="Marking…" busy={pending === "mark_accepted"} disabled={busy} onClick={markAccepted} />
        )}
        {doc.docType === "proposal" && doc.acceptedAt && (
          <ActionButton label="Create Invoice from Proposal" busyLabel="Creating…" busy={pending === "invoice_from_proposal"} disabled={busy} onClick={invoiceFromProposal} primary />
        )}
        {CONVERT_TARGETS[doc.docType].length > 0 && ["approved", "issued", "sent", "delivered", "acknowledged"].includes(doc.status) && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={convertTo} onChange={(e) => setConvertTo(e.target.value as CommercialDocType)} className="v2-input" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
              {CONVERT_TARGETS[doc.docType].map((t) => (
                <option key={t} value={t}>Convert to {TYPE_LABELS[t]}</option>
              ))}
            </select>
            <button type="button" onClick={convert} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              {pending === "convert" ? <Spinner size={11} /> : null} Go
            </button>
          </div>
        )}
      </div>

      {doc.createdByName && <p style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", margin: "8px 0 0" }}>Created by {doc.createdByName}</p>}
      {doc.acceptedAt && (
        <p style={{ fontSize: "0.75rem", color: "#166534", margin: "4px 0 0" }}>
          Accepted {new Date(doc.acceptedAt).toLocaleDateString()}{doc.acceptedByName ? ` (by ${doc.acceptedByName})` : ""}
        </p>
      )}
      {warning && <p style={{ color: "#92400e", fontSize: "0.8rem", margin: "8px 0 0" }}>{warning}</p>}
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </Card>
  );
}

function ActionButton({
  label, busyLabel, busy, disabled, onClick, primary,
}: { label: string; busyLabel: string; busy: boolean; disabled: boolean; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`v2-btn ${primary ? "v2-btn-primary" : "v2-btn-secondary"} ${busy ? "v2-btn-busy" : ""}`}
      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
    >
      {busy && <Spinner size={11} />}
      {busy ? busyLabel : label}
    </button>
  );
}
