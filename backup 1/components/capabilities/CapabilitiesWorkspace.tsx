"use client";

import { useEffect, useState } from "react";
import { WorkloadView } from "@/components/capabilities/WorkloadView";
import { OutcomesView } from "@/components/capabilities/OutcomesView";
import type { ServiceOption, ServiceRollup, PersonWorkload } from "@/components/capabilities/types";

type Tab = "workload" | "outcomes";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "workload", label: "Workload" },
  { key: "outcomes", label: "Outcomes" },
];

export function CapabilitiesWorkspace() {
  const [tab, setTab] = useState<Tab>("workload");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [rollups, setRollups] = useState<ServiceRollup[]>([]);
  const [byPerson, setByPerson] = useState<PersonWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/rollups", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([servicesData, rollupsData]) => {
        setServices(servicesData);
        setRollups(rollupsData.services);
        setByPerson(rollupsData.byPerson);
      })
      .catch(() => setError("Couldn't load capabilities data — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

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

      {services.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      ) : tab === "workload" ? (
        <WorkloadView services={services} rollups={rollups} byPerson={byPerson} />
      ) : (
        <OutcomesView services={services} rollups={rollups} />
      )}
    </div>
  );
}
