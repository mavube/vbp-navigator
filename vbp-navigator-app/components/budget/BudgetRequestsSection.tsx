"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewBudgetRequestForm } from "@/components/budget/NewBudgetRequestForm";
import { BudgetRequestItem } from "@/components/budget/BudgetRequestItem";
import type { ServiceOption, BudgetRequest } from "@/components/budget/types";

export function BudgetRequestsSection({ services }: { services: ServiceOption[] }) {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/budget-requests", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setRequests)
      .catch(() => setError("Couldn't load budget requests — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function serviceName(serviceId: string) {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <Card>
        <NewBudgetRequestForm services={services} onCreated={(req) => setRequests((prev) => [req, ...prev])} />
      </Card>
      {loading ? (
        <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--v2-danger)" }}>{error}</p>
      ) : requests.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>No budget requests yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {requests.map((req) => (
            <BudgetRequestItem
              key={req.id}
              request={req}
              serviceName={serviceName(req.serviceId)}
              onStatusChange={(status) => setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status } : r)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
