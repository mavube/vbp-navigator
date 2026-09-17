"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ServiceOption, ServiceHealth, HealthStatus, CapacitySignal } from "@/components/capabilities/types";

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  at_risk: "At risk",
};
const STATUS_TONE: Record<HealthStatus, "success" | "warning" | "danger"> = {
  healthy: "success",
  attention: "warning",
  at_risk: "danger",
};
const STATUS_ORDER: Record<HealthStatus, number> = { at_risk: 0, attention: 1, healthy: 2 };

const CAPACITY_LABEL: Record<CapacitySignal, string> = {
  idle: "Idle",
  balanced: "Balanced",
  stretched: "Stretched",
  overloaded: "Overloaded",
};

// v3.0 roadmap Phase 7 (§15-16, §18) — Service Health + Capacity
// Intelligence as a third Capabilities tab, alongside the existing
// Workload/Outcomes lenses on the same per-service rollup numbers. At-
// risk services are sorted to the top on purpose: this is meant to be
// scanned in a few seconds, not read top-to-bottom in catalogue order.
export function HealthView({ services, health }: { services: ServiceOption[]; health: ServiceHealth[] }) {
  const healthFor = (serviceId: string) => health.find((h) => h.serviceId === serviceId);
  const rows = services
    .map((s) => ({ service: s, health: healthFor(s.id) }))
    .filter((r): r is { service: ServiceOption; health: ServiceHealth } => !!r.health)
    .sort((a, b) => STATUS_ORDER[a.health.status] - STATUS_ORDER[b.health.status]);

  const atRiskCount = rows.filter((r) => r.health.status === "at_risk").length;
  const attentionCount = rows.filter((r) => r.health.status === "attention").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <Card style={{ padding: "var(--v2-space-4)" }}>
        <div style={{ display: "flex", gap: "var(--v2-space-6)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{atRiskCount}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>At risk</div>
          </div>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{attentionCount}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>Need attention</div>
          </div>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{rows.length - atRiskCount - attentionCount}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>Healthy</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
        {rows.map(({ service, health: h }) => (
          <Card key={service.id} style={{ padding: "var(--v2-space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
              <div style={{ fontWeight: 600 }}>{service.name}</div>
              <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
                <Badge tone="neutral">{CAPACITY_LABEL[h.capacity]}</Badge>
                <Badge tone={STATUS_TONE[h.status]}>{STATUS_LABEL[h.status]}</Badge>
              </div>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", marginTop: "4px" }}>
              Demand: <strong style={{ color: "var(--v2-text)" }}>{h.demand}</strong> active item{h.demand === 1 ? "" : "s"} · Capacity:{" "}
              <strong style={{ color: "var(--v2-text)" }}>{h.people}</strong> {h.people === 1 ? "person" : "people"} assigned
            </div>
            {h.reasons.length > 0 && (
              <ul style={{ margin: "var(--v2-space-2) 0 0", paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>
                {h.reasons.map((reason, i) => (
                  <li key={i}>
                    {reason.href ? (
                      <Link href={reason.href} style={{ color: "var(--v2-accent)" }}>
                        {reason.text}
                      </Link>
                    ) : (
                      reason.text
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
