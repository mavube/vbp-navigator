"use client";

import { useEffect, useState } from "react";
import { BudgetRequestsSection } from "@/components/budget/BudgetRequestsSection";
import { ExpensesSection } from "@/components/budget/ExpensesSection";
import { InvoicesSection } from "@/components/budget/InvoicesSection";
import type { ServiceOption } from "@/components/budget/types";

type Tab = "requests" | "expenses" | "invoices";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "requests", label: "Budget requests" },
  { key: "expenses", label: "Expenses" },
  { key: "invoices", label: "Invoices" },
];

// Fetches the service catalog once and hands it to whichever section is
// active, rather than each of the three sections fetching it
// separately — the sections themselves stay simple, self-contained
// fetch+form+list components (same shape as Tasks/Pipeline/Classes).
export function BudgetWorkspace() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [tab, setTab] = useState<Tab>("requests");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // A failed fetch used to be silently converted into an empty
    // services array (`res.ok ? res.json() : []`), which made a real
    // outage (e.g. the DB being unreachable) look identical to a
    // legitimately empty, freshly-bootstrapped org — "No services in
    // this org yet" either way. Surface the failure instead, same
    // pattern TaskBoard already uses, so the two cases are never
    // confused again.
    fetch("/api/services", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("failed to load");
        return res.json();
      })
      .then((data) => {
        setServices(data);
        setError("");
      })
      .catch(() => setError("Couldn't load services — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", borderBottom: "1px solid var(--v2-border)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="v2-btn"
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--v2-accent)" : "2px solid transparent",
              borderRadius: 0,
              padding: "8px 4px",
              marginRight: "var(--v2-space-4)",
              color: tab === t.key ? "var(--v2-accent)" : "var(--v2-text-muted)",
              fontWeight: tab === t.key ? 600 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      )}

      {tab === "requests" && <BudgetRequestsSection services={services} />}
      {tab === "expenses" && <ExpensesSection services={services} />}
      {tab === "invoices" && <InvoicesSection services={services} />}
    </div>
  );
}
