"use client";

import { Card } from "@/components/ui/Card";
import type { ServiceOption, ServiceRollup } from "@/components/capabilities/types";

function Stat({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", marginRight: "var(--v2-space-3)" }}>
      {label}: <strong style={{ color: "var(--v2-text)" }}>{value.toLocaleString()}</strong>
    </span>
  );
}

// Each service's outcome, paired with real computed numbers instead of
// just the static sentence — per the alignment doc Section 5 ("Outcomes
// — Measured outcomes, not just described").
export function OutcomesView({ services, rollups }: { services: ServiceOption[]; rollups: ServiceRollup[] }) {
  const rollupFor = (serviceId: string) => rollups.find((r) => r.serviceId === serviceId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      {services.map((s) => {
        const r = rollupFor(s.id);
        return (
          <Card key={s.id} style={{ padding: "var(--v2-space-4)" }}>
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            {s.outcome && (
              <p style={{ fontSize: "0.85rem", color: "var(--v2-text-muted)", margin: "4px 0 var(--v2-space-2)" }}>
                {s.outcome}
              </p>
            )}
            <div>
              <Stat label="Tasks done" value={r?.tasksDone ?? 0} />
              <Stat label="Requests resolved" value={r?.requestsResolved ?? 0} />
              <Stat label="Leads admitted" value={r?.leadsAdmitted ?? 0} />
              <Stat label="Classes completed" value={r?.classesCompleted ?? 0} />
              <Stat label="Budget approved" value={r?.budgetApprovedAmount ?? 0} />
              <Stat label="Expenses" value={r?.expensesTotal ?? 0} />
              <Stat label="Compensation finalized" value={r?.compensationFinalizedCount ?? 0} />
              <Stat label="Net pay disbursed" value={r?.compensationNetPayTotal ?? 0} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
