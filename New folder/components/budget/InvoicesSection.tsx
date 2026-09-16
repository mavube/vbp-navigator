"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { ServiceOption, Invoice, InvoiceDirection, InvoiceStatus } from "@/components/budget/types";

const STATUS_TONE: Record<InvoiceStatus, "neutral" | "success" | "danger"> = {
  unpaid: "neutral",
  paid: "success",
  overdue: "danger",
};

export function InvoicesSection({ services }: { services: ServiceOption[] }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [direction, setDirection] = useState<InvoiceDirection>("outgoing");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invoices", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setInvoices)
      .catch(() => setError("Couldn't load invoices — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function serviceName(id: string) {
    return services.find((s) => s.id === id)?.name ?? "Unknown service";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, direction, party, amount: Number(amount) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create invoice");
      }
      const invoice: Invoice = await res.json();
      setInvoices((prev) => [invoice, ...prev]);
      setParty("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create invoice");
    } finally {
      setBusy(false);
    }
  }

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
        <form onSubmit={submit} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ maxWidth: 220 }}>
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
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ maxWidth: 140 }} />
          <Button type="submit" loading={busy} disabled={!serviceId || !party.trim() || !amount}>
            {busy ? "Creating…" : "Create invoice"}
          </Button>
        </form>
      </Card>
      {loading ? (
        <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--v2-danger)" }}>{error}</p>
      ) : invoices.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>No invoices yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          {invoices.map((inv) => (
            <Card key={inv.id} style={{ padding: "var(--v2-space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {inv.party} <span style={{ fontWeight: 400, color: "var(--v2-text-faint)" }}>· {inv.direction}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>{serviceName(inv.serviceId)}</div>
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
