"use client";

import { useEffect, useState } from "react";
import { WorkloadView } from "@/components/capabilities/WorkloadView";
import { OutcomesView } from "@/components/capabilities/OutcomesView";
import { HealthView } from "@/components/capabilities/HealthView";
import type { ServiceOption, ServiceRollup, PersonWorkload, FiscalYearTotals, ServiceHealth } from "@/components/capabilities/types";

type Tab = "workload" | "outcomes" | "health";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "workload", label: "Workload" },
  { key: "outcomes", label: "Outcomes" },
  { key: "health", label: "Health" },
];

export function CapabilitiesWorkspace() {
  const [tab, setTab] = useState<Tab>("workload");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [rollups, setRollups] = useState<ServiceRollup[]>([]);
  const [byPerson, setByPerson] = useState<PersonWorkload[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearTotals[]>([]);
  const [health, setHealth] = useState<ServiceHealth[]>([]);
  // undefined = all-time (the pre-Phase-3 default, unchanged). A
  // specific year scopes Outcomes' financial stats (Budget approved /
  // Expenses / Net pay) to that fiscal year — operational stats
  // (tasks/leads/classes) stay all-time regardless, per lib/rollups.ts.
  const [fiscalYear, setFiscalYear] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const rollupsUrl = fiscalYear ? `/api/rollups?fy=${fiscalYear}` : "/api/rollups";
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch(rollupsUrl, { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([servicesData, rollupsData]) => {
        setServices(servicesData);
        setRollups(rollupsData.services);
        setByPerson(rollupsData.byPerson);
        setFiscalYears(rollupsData.fiscalYears);
        setHealth(rollupsData.health);
        setError("");
      })
      .catch(() => setError("Couldn't load capabilities data — try refreshing."))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

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

      {services.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      ) : tab === "workload" ? (
        <WorkloadView services={services} rollups={rollups} byPerson={byPerson} />
      ) : tab === "outcomes" ? (
        <OutcomesView
          services={services}
          rollups={rollups}
          fiscalYears={fiscalYears}
          fiscalYear={fiscalYear}
          onFiscalYearChange={setFiscalYear}
        />
      ) : (
        <HealthView services={services} health={health} />
      )}
    </div>
  );
}
