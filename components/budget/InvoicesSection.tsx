"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { ServiceOption, Invoice, InvoiceDirection, InvoiceStatus, InvoiceLineItem, ClassOption, LeadOption } from "@/components/budget/types";

const STATUS_TONE: Record<InvoiceStatus, "neutral" | "success" | "danger"> = {
  unpaid: "neutral",
  paid: "success",
  overdue: "danger",
};

type DraftLine = { description: string; quantity: string; unitAmount: string };
const BLANK_LINE: DraftLine = { description: "", quantity: "1", unitAmount: "" };

export function InvoicesSection({ services, filterServiceId }: { services: ServiceOption[]; filterServiceId?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [direction, setDirection] = useState<InvoiceDirection>("outgoing");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [classId, setClassId] = useState("");
  const [leadId, setLeadId] = useState("");
  // v3.0 roadmap Phase 10 (Cluster C) — line items were captured by the
  // API since Phase 5 but never exposed on this form; a flat amount is
  // still the default (most invoices are simple), with line items as an
  // opt-in toggle for the ones that aren't. See app/api/invoices/route.ts
  // for why the total is always computed from these, never client-sent.
  const [showLineItems, setShowLineItems] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([{ ...BLANK_LINE }]);
  const [busy, setBusy] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/classes", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch("/api/leads", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([invoicesData, classesData, leadsData]) => {
        setInvoices(invoicesData);
        setClasses(classesData);
        setLeads(leadsData);
      })
      .catch(() => setError("Couldn't load invoices — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function serviceName(id: string) {
    return services.find((s) => s.id === id)?.name ?? "Unknown service";
  }

  const validLines = lines
    .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity), unitAmount: Number(l.unitAmount) }))
    .filter((l) => l.description && Number.isFinite(l.quantity) && l.quantity > 0 && Number.isFinite(l.unitAmount) && l.unitAmount >= 0);
  const lineItemsTotal = validLines.reduce((sum, l) => sum + l.quantity * l.unitAmount, 0);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...BLANK_LINE }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          direction,
          party,
          amount: Number(amount),
          lineItems: showLineItems ? validLines : undefined,
          dueDate: dueDate || undefined,
          classId: direction === "outgoing" && classId ? classId : undefined,
          leadId: direction === "outgoing" && leadId ? leadId : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create invoice");
      }
      const invoice: Invoice = await res.json();
      setInvoices((prev) => [invoice, ...prev]);
      setParty("");
      setAmount("");
      setDueDate("");
      setClassId("");
      setLeadId("");
      setShowLineItems(false);
      setLines([{ ...BLANK_LINE }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create invoice");
    } finally {
      setBusy(false);
    }
  }

  const serviceClasses = classes.filter((c) => c.serviceId === serviceId);
  const serviceLeads = leads.filter((l) => l.serviceId === serviceId);
  const canSubmit = !!serviceId && !!party.trim() && (showLineItems ? validLines.length > 0 : !!amount);

  async function markPaid(id: string) {
    setMarkingPaidId(id);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      if (res.ok) {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: "paid" } : inv)));
      }
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
            <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setClassId(""); setLeadId(""); }} required className="v2-input" style={{ maxWidth: 220 }}>
              <option value="" disabled>Service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={direction} onChange={(e) => setDirection(e.target.value as InvoiceDirection)} className="v2-input" style={{ maxWidth: 140 }}>
              <option value="outgoing">Outgoing</option>
              <option value="incoming">Incoming</option>
            </select>
            <Input
              placeholder={direction === "outgoing" ? "Customer" : "Vendor"}
              value={party}
              onChange={(e) => setParty(e.target.value)}
              required
              style={{ flex: "1 1 180px" }}
            />
            {!showLineItems && (
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ maxWidth: 140 }} />
            )}
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              title="Due date (optional — required for the 'overdue' status to ever apply)"
              style={{ maxWidth: 160 }}
            />
          </div>

          {/* v3.0 roadmap Phase 10 — linkage picker: the API has taken
              classId/leadId since Phase 5 (Section 6), this just exposes
              it. Only meaningful for an outgoing invoice (billing a
              customer for a Class or a Lead's engagement) — an incoming
              vendor bill links to an Expense instead, set elsewhere. */}
          {direction === "outgoing" && serviceId && (serviceClasses.length > 0 || serviceLeads.length > 0) && (
            <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
              {serviceClasses.length > 0 && (
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="v2-input" style={{ maxWidth: 240 }}>
                  <option value="">Link to a class (optional)…</option>
                  {serviceClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
              {serviceLeads.length > 0 && (
                <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="v2-input" style={{ maxWidth: 240 }}>
                  <option value="">Link to a lead (optional)…</option>
                  {serviceLeads.map((l) => (
                    <option key={l.id} value={l.id}>{l.contactName}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {showLineItems ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)", padding: "var(--v2-space-3)", background: "var(--v2-surface-sunken)", borderRadius: "var(--v2-radius-sm)" }}>
              {lines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "center" }}>
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    style={{ flex: "1 1 200px" }}
                  />
                  <Input
                    type="number" min="1" step="1" placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    style={{ maxWidth: 90 }}
                  />
                  <Input
                    type="number" min="0" step="0.01" placeholder="Unit amount"
                    value={line.unitAmount}
                    onChange={(e) => updateLine(i, { unitAmount: e.target.value })}
                    style={{ maxWidth: 130 }}
                  />
                  <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                    Remove
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" onClick={addLine} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem", alignSelf: "flex-start" }}>
                  + Add line
                </button>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Total: {lineItemsTotal.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => { setShowLineItems(false); setLines([{ ...BLANK_LINE }]); }}
                className="v2-btn v2-btn-secondary"
                style={{ padding: "4px 10px", fontSize: "0.75rem", alignSelf: "flex-start" }}
              >
                Use a flat amount instead
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowLineItems(true)} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem", alignSelf: "flex-start" }}>
              Break this down into line items…
            </button>
          )}

          <Button type="submit" loading={busy} disabled={!canSubmit} style={{ alignSelf: "flex-start" }}>
            {busy ? "Creating…" : "Create invoice"}
          </Button>
        </form>
      </Card>
      {loading ? (
        <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--v2-danger)" }}>{error}</p>
      ) : invoices.filter((i) => !filterServiceId || i.serviceId === filterServiceId).length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>{invoices.length === 0 ? "No invoices yet." : "No invoices for this service."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          {invoices.filter((i) => !filterServiceId || i.serviceId === filterServiceId).map((inv) => (
            <Card key={inv.id} style={{ padding: "var(--v2-space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {inv.party} <span style={{ fontWeight: 400, color: "var(--v2-text-faint)" }}>· {inv.direction}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
                    {serviceName(inv.serviceId)}
                    {inv.dueDate ? ` · due ${inv.dueDate}` : ""}
                    {inv.classId ? ` · ${classes.find((c) => c.id === inv.classId)?.title ?? "linked class"}` : ""}
                    {inv.leadId ? ` · ${leads.find((l) => l.id === inv.leadId)?.contactName ?? "linked lead"}` : ""}
                  </div>
                  {inv.lineItems.length > 0 && (
                    <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)", marginTop: "4px" }}>
                      {inv.lineItems.map((li, i) => (
                        <div key={i}>
                          {li.description} — {li.quantity} × {li.unitAmount.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()}</span>
                  <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  {inv.status === "unpaid" && (
                    <button
                      type="button"
                      onClick={() => markPaid(inv.id)}
                      disabled={markingPaidId !== null}
                      className={`v2-btn v2-btn-secondary ${markingPaidId === inv.id ? "v2-btn-busy" : ""}`}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {markingPaidId === inv.id && <Spinner size={11} />}
                      {markingPaidId === inv.id ? "Marking…" : "Mark paid"}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
