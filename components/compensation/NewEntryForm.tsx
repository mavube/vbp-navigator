"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, CompensationEntry, AllowanceLine } from "@/components/compensation/types";

export function NewEntryForm({
  services,
  onCreated,
}: {
  services: ServiceOption[];
  onCreated: (entry: CompensationEntry) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState("");
  const [basicPay, setBasicPay] = useState("");
  const [allowances, setAllowances] = useState<AllowanceLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function addAllowance() {
    setAllowances((prev) => [...prev, { name: "", amount: 0 }]);
  }
  function updateAllowance(index: number, field: "name" | "amount", value: string) {
    setAllowances((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: field === "amount" ? Number(value) || 0 : value } : a))
    );
  }
  function removeAllowance(index: number) {
    setAllowances((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/compensation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          employeeName,
          period,
          basicPay: Number(basicPay),
          allowances: allowances.filter((a) => a.name.trim()),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create entry");
      }
      const entry: CompensationEntry = await res.json();
      onCreated(entry);
      setEmployeeName("");
      setBasicPay("");
      setAllowances([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ maxWidth: 240 }}>
          <option value="" disabled>Service…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Input placeholder="Employee name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required style={{ flex: "1 1 180px" }} />
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required style={{ maxWidth: 160 }} />
        <Input type="number" min="0" step="0.01" placeholder="Basic pay" value={basicPay} onChange={(e) => setBasicPay(e.target.value)} required style={{ maxWidth: 140 }} />
      </div>

      <div>
        <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)", marginBottom: "4px" }}>Allowances</div>
        {allowances.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
            <Input placeholder="Name (e.g. Housing)" value={a.name} onChange={(e) => updateAllowance(i, "name", e.target.value)} style={{ flex: "1 1 160px", fontSize: "0.85rem" }} />
            <Input type="number" min="0" step="0.01" placeholder="Amount" value={a.amount || ""} onChange={(e) => updateAllowance(i, "amount", e.target.value)} style={{ maxWidth: 120, fontSize: "0.85rem" }} />
            <button type="button" onClick={() => removeAllowance(i)} className="v2-btn v2-btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addAllowance} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
          + Add allowance
        </button>
      </div>

      <div>
        <Button type="submit" loading={busy} disabled={!serviceId || !employeeName.trim() || !period || !basicPay}>
          {busy ? "Computing…" : "Create draft entry"}
        </Button>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", margin: 0 }}>{error}</p>}
    </form>
  );
}
