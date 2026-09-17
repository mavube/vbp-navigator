"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LineItemEditor } from "@/components/commercial/LineItemEditor";
import type {
  CommercialDocType,
  CommercialDocument,
  ServiceOption,
  LeadOption,
  EngagementOption,
  CustomerOption,
  LineItem,
} from "@/components/commercial/types";

const TYPE_LABELS: Record<CommercialDocType, string> = { proposal: "Proposal", quotation: "Quotation", invoice: "Invoice" };
type AnchorMode = "none" | "lead" | "engagement" | "customer";

// Diallo: "not every transaction starts with a proposal... some start
// directly with an invoice." So the anchor picker itself defaults to
// "none" (phone/email order — type the recipient by hand) rather than
// forcing a lead or engagement to exist first — the four modes here
// map 1:1 onto lib/document-context.ts's resolveCommercialAnchor.
export function NewCommercialDocumentForm({
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
  onCreated: (doc: CommercialDocument) => void;
}) {
  const [docType, setDocType] = useState<CommercialDocType>("invoice");
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("none");
  const [serviceId, setServiceId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [details, setDetails] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitAmount: 0 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function customerName(id: string) {
    return customers.find((c) => c.id === id)?.fullName ?? "Unknown customer";
  }
  function serviceName(id: string) {
    return services.find((s) => s.id === id)?.name ?? "Unknown service";
  }

  const needsService = anchorMode === "none" || anchorMode === "customer";
  const canSubmit =
    (anchorMode === "lead" && leadId) ||
    (anchorMode === "engagement" && engagementId) ||
    (anchorMode === "customer" && customerId && serviceId) ||
    (anchorMode === "none" && serviceId && recipientName.trim() && recipientEmail.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const validItems = lineItems.filter((i) => i.description.trim() && i.quantity > 0);
      const res = await fetch("/api/commercial-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          serviceId: needsService ? serviceId : undefined,
          leadId: anchorMode === "lead" ? leadId : undefined,
          engagementId: anchorMode === "engagement" ? engagementId : undefined,
          customerId: anchorMode === "customer" ? customerId : undefined,
          recipientName: anchorMode === "none" ? recipientName : undefined,
          recipientEmail: anchorMode === "none" ? recipientEmail : undefined,
          details,
          currency,
          dueDate: dueDate || undefined,
          lineItems: validItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't create document");
      }
      const doc: CommercialDocument = await res.json();
      onCreated(doc);
      setDetails("");
      setRecipientName("");
      setRecipientEmail("");
      setLineItems([{ description: "", quantity: 1, unitAmount: 0 }]);
      setDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <select value={docType} onChange={(e) => setDocType(e.target.value as CommercialDocType)} className="v2-input" style={{ maxWidth: 200 }}>
          {(Object.keys(TYPE_LABELS) as CommercialDocType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={anchorMode} onChange={(e) => setAnchorMode(e.target.value as AnchorMode)} className="v2-input" style={{ maxWidth: 260 }}>
          <option value="none">No prior record — type recipient directly</option>
          <option value="lead">From a Lead</option>
          <option value="engagement">From an Engagement</option>
          <option value="customer">From an existing Customer</option>
        </select>
      </div>

      {anchorMode === "lead" && (
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required className="v2-input">
          <option value="" disabled>Which lead…</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>{l.contactName} — {serviceName(l.serviceId)} ({l.stage})</option>
          ))}
        </select>
      )}
      {anchorMode === "engagement" && (
        <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)} required className="v2-input">
          <option value="" disabled>Which engagement…</option>
          {engagements.map((eng) => (
            <option key={eng.id} value={eng.id}>{customerName(eng.customerId)} — {serviceName(eng.serviceId)} ({eng.status})</option>
          ))}
        </select>
      )}
      {anchorMode === "customer" && (
        <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="v2-input" style={{ flex: "1 1 200px" }}>
            <option value="" disabled>Which customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ flex: "1 1 200px" }}>
            <option value="" disabled>Which service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {anchorMode === "none" && (
        <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ flex: "1 1 160px" }}>
            <option value="" disabled>Which service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Input placeholder="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} style={{ flex: "1 1 160px" }} />
          <Input type="email" placeholder="Recipient email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} style={{ flex: "1 1 160px" }} />
        </div>
      )}

      <textarea
        className="v2-input"
        rows={2}
        placeholder="Cover note details (optional — what the accompanying message should mention)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />

      <LineItemEditor items={lineItems} onChange={setLineItems} currency={currency} />

      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <Input placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 10))} style={{ width: 100 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
          Due date
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>

      <div>
        <Button type="submit" disabled={busy || !canSubmit}>
          {busy ? "Creating…" : `Create ${TYPE_LABELS[docType]}`}
        </Button>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", margin: 0 }}>{error}</p>}
    </form>
  );
}
