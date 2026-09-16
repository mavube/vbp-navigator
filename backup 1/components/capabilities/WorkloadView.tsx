"use client";

import { Card } from "@/components/ui/Card";
import type { ServiceOption, ServiceRollup, PersonWorkload } from "@/components/capabilities/types";

function Stat({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", marginRight: "var(--v2-space-3)" }}>
      {label}: <strong style={{ color: "var(--v2-text)" }}>{value}</strong>
    </span>
  );
}

// Capacity view: what's currently active per service, and per person
// (Tasks-only for now — see lib/rollups.ts's file comment).
export function WorkloadView({
  services,
  rollups,
  byPerson,
}: {
  services: ServiceOption[];
  rollups: ServiceRollup[];
  byPerson: PersonWorkload[];
}) {
  const rollupFor = (serviceId: string) => rollups.find((r) => r.serviceId === serviceId);
  const totalActive = (r: ServiceRollup | undefined) =>
    (r?.tasksOpen ?? 0) + (r?.requestsOpen ?? 0) + (r?.leadsActive ?? 0) + (r?.classesActive ?? 0);

  const withLoad = services
    .map((s) => ({ service: s, rollup: rollupFor(s.id) }))
    .filter(({ rollup }) => totalActive(rollup) > 0);
  const idle = services.length - withLoad.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          By service
        </h2>
        {withLoad.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>Nothing active anywhere right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
            {withLoad.map(({ service, rollup }) => (
              <Card key={service.id} style={{ padding: "var(--v2-space-3)" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>{service.name}</div>
                <div>
                  <Stat label="Tasks open" value={rollup?.tasksOpen ?? 0} />
                  <Stat label="Requests open" value={rollup?.requestsOpen ?? 0} />
                  <Stat label="Leads active" value={rollup?.leadsActive ?? 0} />
                  <Stat label="Classes active" value={rollup?.classesActive ?? 0} />
                </div>
              </Card>
            ))}
          </div>
        )}
        {idle > 0 && (
          <p style={{ color: "var(--v2-text-faint)", fontSize: "0.8rem", marginTop: "var(--v2-space-2)" }}>
            {idle} other service{idle === 1 ? "" : "s"} with nothing active right now.
          </p>
        )}
      </div>

      <div>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          By person (open + in-progress tasks)
        </h2>
        {byPerson.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>
            No tasks have an assignee yet — add one when creating a task on the Tasks page.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
            {byPerson.map((p) => (
              <Card key={p.name} style={{ padding: "var(--v2-space-3)", display: "flex", justifyContent: "space-between" }}>
                <span>{p.name}</span>
                <strong>{p.activeTasks}</strong>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
