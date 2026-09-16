"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { CompensationEntry } from "@/components/compensation/types";

export function EntryItem({
  entry,
  serviceName,
  onFinalized,
}: {
  entry: CompensationEntry;
  serviceName: string;
  onFinalized: (entry: CompensationEntry) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const grossPay = entry.basicPay + entry.allowances.reduce((sum, a) => sum + a.amount, 0);

  async function finalize() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/compensation/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "finalized" }),
      });
      if (res.ok) {
        onFinalized(await res.json());
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't finalize entry");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{entry.employeeName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName} · {entry.period}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={entry.status === "finalized" ? "success" : "neutral"}>{entry.status}</Badge>
          {entry.status === "draft" && (
            <button
              type="button"
              onClick={finalize}
              disabled={busy}
              className={`v2-btn v2-btn-secondary ${busy ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy && <Spinner size={11} />}
              {busy ? "Finalizing…" : "Finalize"}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}

      <div style={{ marginTop: "var(--v2-space-3)", borderTop: "1px solid var(--v2-border)", paddingTop: "var(--v2-space-3)", fontSize: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Basic pay</span>
          <span>{entry.basicPay.toLocaleString()}</span>
        </div>
        {entry.allowances.map((a, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "var(--v2-text-faint)" }}>
            <span>+ {a.name}</span>
            <span>{a.amount.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, borderTop: "1px solid var(--v2-border)", marginTop: "4px", paddingTop: "4px" }}>
          <span>Gross pay</span>
          <span>{grossPay.toLocaleString()}</span>
        </div>
        {entry.deductions.map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "var(--v2-danger)" }}>
            <span>− {d.name}</span>
            <span>{d.amount.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--v2-border)", marginTop: "4px", paddingTop: "4px" }}>
          <span>Net pay</span>
          <span>{entry.netPay.toLocaleString()}</span>
        </div>
      </div>
    </Card>
  );
}
