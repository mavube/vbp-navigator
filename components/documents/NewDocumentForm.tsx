"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DOCUMENT_TYPE_LABELS, PRE_ENGAGEMENT_TYPES, COMMERCIAL_TYPES, type DocumentType } from "@/lib/document-templates";
import type { DocumentRecord, LeadOption, EngagementOption, CustomerOption, ServiceOption } from "@/components/documents/types";

// Proposal/Quotation/Invoice live in the Commercial Docs module now
// (Phase 14) — this form only offers the five plain letter types.
const TYPES = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).filter((t) => !COMMERCIAL_TYPES.has(t));

export function NewDocumentForm({
  services,
  leads,
  engagements,
  customers,
  onCreated,
}: {
  services: ServiceOption[];
  leads: LeadOption[];
  engagements: EngagementOption[];
  customers: CustomerOption[];
  onCreated: (doc: DocumentRecord) => void;
}) {
  const [docType, setDocType] = useState<DocumentType>("invitation");
  const [leadId, setLeadId] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [details, setDetails] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [showRecipientOverride, setShowRecipientOverride] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPreEngagement = PRE_ENGAGEMENT_TYPES.has(docType);

  function serviceName(id: string) {
    return services.find((s) => s.id === id)?.name ?? "Unknown service";
  }
  function customerName(id: string) {
    return customers.find((c) => c.id === id)?.fullName ?? "Unknown customer";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          leadId: isPreEngagement ? leadId : undefined,
          engagementId: isPreEngagement ? undefined : engagementId,
          details,
          recipientName: recipientName || undefined,
          recipientEmail: recipientEmail || undefined,
          attachmentUrl: attachmentUrl || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't generate document");
      }
      const doc: DocumentRecord = await res.json();
      onCreated(doc);
      setDetails("");
      setLeadId("");
      setEngagementId("");
      setRecipientName("");
      setRecipientEmail("");
      setShowRecipientOverride(false);
      setAttachmentUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <select
          value={docType}
          onChange={(e) => {
            setDocType(e.target.value as DocumentType);
            setLeadId("");
            setEngagementId("");
          }}
          className="v2-input"
          style={{ maxWidth: 260 }}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        {isPreEngagement ? (
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required className="v2-input" style={{ maxWidth: 300 }}>
            <option value="" disabled>
              Which lead is this for…
            </option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.contactName} — {serviceName(l.serviceId)} ({l.stage})
              </option>
            ))}
          </select>
        ) : (
          <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)} required className="v2-input" style={{ maxWidth: 300 }}>
            <option value="" disabled>
              Which engagement is this for…
            </option>
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {customerName(eng.customerId)} — {serviceName(eng.serviceId)} ({eng.status})
              </option>
            ))}
          </select>
        )}
      </div>

      <textarea
        className="v2-input"
        rows={3}
        placeholder={isPreEngagement ? "Details specific to this document (price, date, justification…)" : "Details specific to this document (optional)"}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />

      {/* v3.0 roadmap Phase 10 (Cluster C) — a link to a supporting file
          (a signed copy, a scanned attachment) that lives wherever it
          already does — Drive, SharePoint, email — not an upload into
          this app. Same "URL field, not real storage" pattern as an
          Expense's receipt link. */}
      <Input
        type="url"
        placeholder="Attachment link (optional)"
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
      />

      {/* Quick win: recipient name/email are otherwise always derived
          from the linked lead/engagement — this override only matters
          for the one-off case (the document actually needs to go to
          someone else), so it's tucked behind a toggle rather than two
          more always-visible fields on every generation. */}
      {showRecipientOverride ? (
        <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <Input
            placeholder="Recipient name override (optional)"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
          <Input
            type="email"
            placeholder="Recipient email override (optional)"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowRecipientOverride(true)}
          className="v2-btn v2-btn-secondary"
          style={{ padding: "4px 10px", fontSize: "0.75rem", alignSelf: "flex-start" }}
        >
          Send to someone else…
        </button>
      )}

      {isPreEngagement && leads.length === 0 && (
        <p className="v2-public-hint">No leads yet — add one on Pipeline first.</p>
      )}
      {!isPreEngagement && engagements.length === 0 && (
        <p className="v2-public-hint">No engagements yet — a lead needs to be marked won on Pipeline first.</p>
      )}

      <div>
        <Button type="submit" disabled={busy || (isPreEngagement ? !leadId : !engagementId)}>
          {busy ? "Generating…" : "Generate document"}
        </Button>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", margin: 0 }}>{error}</p>}
    </form>
  );
}
