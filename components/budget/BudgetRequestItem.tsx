"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { CommentThread } from "@/components/collaboration/CommentThread";
import type { BudgetRequest, BudgetStatus, Quotation } from "@/components/budget/types";

const STATUS_TONE: Record<BudgetStatus, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
};

export function BudgetRequestItem({
  request,
  serviceName,
  onStatusChange,
}: {
  request: BudgetRequest;
  serviceName: string;
  onStatusChange: (status: BudgetStatus) => void;
}) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [vendor, setVendor] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/budget-requests/${request.id}/quotations`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setQuotations);
  }, [request.id]);

  async function setStatus(status: "approved" | "rejected") {
    setError("");
    const res = await fetch(`/api/budget-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      onStatusChange(status);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't update status");
    }
  }

  async function addQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor.trim() || !quoteAmount) return;
    const res = await fetch(`/api/budget-requests/${request.id}/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor, amount: Number(quoteAmount) }),
    });
    if (res.ok) {
      const q: Quotation = await res.json();
      setQuotations((prev) => [q, ...prev]);
      setVendor("");
      setQuoteAmount("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't add quotation");
    }
  }

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{request.purpose}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName} · {request.source === "petty_cash" ? "Petty cash" : "Direct"} · {request.amount.toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
          {request.status === "pending" && (
            <>
              <button type="button" onClick={() => setStatus("approved")} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                Approve
              </button>
              <button type="button" onClick={() => setStatus("rejected")} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                Reject
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}

      <div style={{ marginTop: "var(--v2-space-3)", borderTop: "1px solid var(--v2-border)", paddingTop: "var(--v2-space-3)" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", marginBottom: "var(--v2-space-2)" }}>
          Quotations {quotations.length > 0 ? `(${quotations.length})` : ""}
        </div>
        {quotations.map((q) => (
          <div key={q.id} style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
            {q.vendor} — {q.amount.toLocaleString()}
          </div>
        ))}
        <form onSubmit={addQuotation} style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
          <Input placeholder="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} style={{ flex: "1 1 140px", fontSize: "0.8rem" }} />
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} style={{ maxWidth: 110, fontSize: "0.8rem" }} />
          <button type="submit" className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Add quote
          </button>
        </form>
      </div>

      <CommentThread entityType="budget_request" entityId={request.id} />
    </Card>
  );
}
