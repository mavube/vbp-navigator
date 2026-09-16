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

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setServices);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-5)" }}>
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
