"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, Expense } from "@/components/budget/types";

export function ExpensesSection({ services }: { services: ServiceOption[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/expenses", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setExpenses)
      .catch(() => setError("Couldn't load expenses — try refreshing."))
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
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          amount: Number(amount),
          description,
          expenseDate: expenseDate || undefined,
          receiptUrl: receiptUrl || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't log expense");
      }
      const expense: Expense = await res.json();
      setExpenses((prev) => [expense, ...prev]);
      setAmount("");
      setDescription("");
      setExpenseDate("");
      setReceiptUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log expense");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <Card>
        <form onSubmit={submit} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ maxWidth: 240 }}>
            <option value="" disabled>Service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ flex: "1 1 220px" }} />
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ maxWidth: 140 }} />
          <Input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            title="Expense date (defaults to today if left blank)"
            style={{ maxWidth: 160 }}
          />
          <Input
            placeholder="Receipt link (optional)"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
          <Button type="submit" disabled={busy || !serviceId || !amount}>
            {busy ? "Logging…" : "Log expense"}
          </Button>
        </form>
      </Card>
      {loading ? (
        <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--v2-danger)" }}>{error}</p>
      ) : expenses.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>No expenses logged yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          {expenses.map((exp) => (
            <Card key={exp.id} style={{ padding: "var(--v2-space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{exp.description || "Expense"}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
                    {serviceName(exp.serviceId)} · {exp.expenseDate}
                    {exp.receiptUrl && (
                      <>
                        {" · "}
                        <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--v2-accent)" }}>
                          Receipt
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>{exp.amount.toLocaleString()}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
