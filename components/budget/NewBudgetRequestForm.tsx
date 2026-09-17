"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, BudgetRequest, BudgetSource } from "@/components/budget/types";

export function NewBudgetRequestForm({
  services,
  onCreated,
}: {
  services: ServiceOption[];
  onCreated: (req: BudgetRequest) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [source, setSource] = useState<BudgetSource>("direct");
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/budget-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, source, purpose, amount: Number(amount), neededBy: neededBy || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't submit request");
      }
      const req: BudgetRequest = await res.json();
      onCreated(req);
      setPurpose("");
      setAmount("");
      setNeededBy("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
      <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ maxWidth: 240 }}>
        <option value="" disabled>Service…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select value={source} onChange={(e) => setSource(e.target.value as BudgetSource)} className="v2-input" style={{ maxWidth: 160 }}>
        <option value="direct">Direct</option>
        <option value="petty_cash">Petty cash</option>
      </select>
      <Input
        placeholder="Purpose"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        required
        style={{ flex: "1 1 220px" }}
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        style={{ maxWidth: 140 }}
      />
      <Input
        type="date"
        value={neededBy}
        onChange={(e) => setNeededBy(e.target.value)}
        title="Needed by (optional)"
        style={{ maxWidth: 160 }}
      />
      <Button type="submit" disabled={busy || !serviceId || !purpose.trim() || !amount}>
        {busy ? "Submitting…" : "Submit request"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
