"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DOCUMENT_TYPE_LABELS } from "@/lib/document-templates";
import type { DocumentRecord, DocumentStatus } from "@/components/documents/types";

const STATUS_TONE: Record<DocumentStatus, "neutral" | "accent" | "success" | "danger"> = {
  draft: "neutral",
  pending_approval: "accent",
  approved: "success",
  rejected: "danger",
};
const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export function DocumentItem({ doc, onChange }: { doc: DocumentRecord; onChange: (updated: DocumentRecord) => void }) {
  const [details, setDetails] = useState(doc.details);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  async function action(path: string, body: Record<string, unknown>, method: "PATCH" | "POST" = "PATCH") {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't complete that action");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete that action");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    const data = await action(`/api/documents/${doc.id}/regenerate`, { details }, "POST");
    if (data) onChange({ ...doc, title: data.title, body: data.body, details: data.details });
  }
  async function submitForApproval() {
    const data = await action(`/api/documents/${doc.id}`, { action: "submit" });
    if (data) onChange({ ...doc, status: "pending_approval" });
  }
  async function decide(approve: boolean) {
    const data = await action(`/api/documents/${doc.id}`, { action: approve ? "approve" : "reject" });
    if (data) onChange({ ...doc, status: data.status });
  }
  async function markSent() {
    const data = await action(`/api/documents/${doc.id}`, { action: "mark_sent" });
    if (data) onChange({ ...doc, sentAt: new Date().toISOString() });
  }
  async function newVersion() {
    const data = await action(`/api/documents/${doc.id}/new-version`, { details }, "POST");
    if (data) onChange(data as DocumentRecord);
  }

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{doc.title}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {doc.recipientName}
            {doc.recipientEmail ? ` · ${doc.recipientEmail}` : ""} · v{doc.version}
            {doc.sentAt ? " · Sent" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone="neutral">{DOCUMENT_TYPE_LABELS[doc.docType]}</Badge>
          <Badge tone={STATUS_TONE[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="v2-btn v2-btn-secondary"
        style={{ padding: "4px 10px", fontSize: "0.75rem", marginTop: "var(--v2-space-3)" }}
      >
        {expanded ? "Hide document" : "View document"}
      </button>

      {expanded && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "0.85rem",
            color: "var(--v2-text)",
            background: "var(--v2-surface-sunken)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "var(--v2-space-3)",
            marginTop: "var(--v2-space-2)",
          }}
        >
          {doc.body}
        </div>
      )}

      {doc.status === "draft" && (
        <div style={{ marginTop: "var(--v2-space-3)", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <textarea className="v2-input" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          <div style={{ display: "flex", gap: "var(--v2-space-2)" }}>
            <button type="button" onClick={regenerate} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Regenerate
            </button>
            <button type="button" onClick={submitForApproval} disabled={busy} className="v2-btn v2-btn-primary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Submit for approval
            </button>
          </div>
        </div>
      )}

      {doc.status === "pending_approval" && (
        <div style={{ marginTop: "var(--v2-space-3)", display: "flex", gap: "var(--v2-space-2)" }}>
          <button type="button" onClick={() => decide(true)} disabled={busy} className="v2-btn v2-btn-primary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Approve
          </button>
          <button type="button" onClick={() => decide(false)} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Reject
          </button>
        </div>
      )}

      {doc.status === "approved" && (
        <div style={{ marginTop: "var(--v2-space-3)", display: "flex", gap: "var(--v2-space-2)" }}>
          {!doc.sentAt && (
            <button type="button" onClick={markSent} disabled={busy} className="v2-btn v2-btn-primary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Mark sent
            </button>
          )}
          <button type="button" onClick={newVersion} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Create new version
          </button>
        </div>
      )}

      {doc.status === "rejected" && (
        <div style={{ marginTop: "var(--v2-space-3)" }}>
          <button type="button" onClick={newVersion} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Create new version
          </button>
        </div>
      )}

      {doc.approvedByName && (doc.status === "approved" || doc.status === "rejected") && (
        <p style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", margin: "8px 0 0" }}>
          {doc.status === "approved" ? "Approved" : "Rejected"} by {doc.approvedByName}
        </p>
      )}

      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </Card>
  );
}
