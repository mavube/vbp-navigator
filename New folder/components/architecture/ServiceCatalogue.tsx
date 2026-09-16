"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ServiceRow } from "@/lib/db-services";

interface ServiceCatalogueProps {
  services: ServiceRow[];
}

type View = "by-service" | "by-provider";

// v3.0 roadmap Phase 2 — replaces the old static ServiceCards.tsx
// (hardcoded JSX, one block per VBP service, that never read the
// `services` table at all) with a view driven entirely by real data.
// Works for any org's catalog, not just VBP's specific 10 services.
export function ServiceCatalogue({ services }: ServiceCatalogueProps) {
  const [view, setView] = useState<View>("by-service");
  const byId = new Map(services.map((s) => [s.id, s]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown service";

  const cvs = services.filter((s) => s.type === "cvs");
  const enabling = services.filter((s) => s.type === "enabling");

  const byProvider = new Map<string, ServiceRow[]>();
  for (const s of services) {
    const key = s.providerName || (s.providerId ? "Assigned (name unavailable)" : "Not assigned");
    byProvider.set(key, [...(byProvider.get(key) ?? []), s]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)" }}>
        <button
          type="button"
          className="v2-btn"
          onClick={() => setView("by-service")}
          style={{
            background: view === "by-service" ? "var(--v2-accent-soft)" : "var(--v2-surface)",
            color: view === "by-service" ? "var(--v2-accent)" : "var(--v2-text-muted)",
            border: "1px solid " + (view === "by-service" ? "transparent" : "var(--v2-border-strong)"),
          }}
        >
          By service
        </button>
        <button
          type="button"
          className="v2-btn"
          onClick={() => setView("by-provider")}
          style={{
            background: view === "by-provider" ? "var(--v2-accent-soft)" : "var(--v2-surface)",
            color: view === "by-provider" ? "var(--v2-accent)" : "var(--v2-text-muted)",
            border: "1px solid " + (view === "by-provider" ? "transparent" : "var(--v2-border-strong)"),
          }}
        >
          By provider
        </button>
      </div>

      {view === "by-service" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-8)" }}>
          <ServiceGroup title={`Customer Value Services (${cvs.length})`} services={cvs} nameOf={nameOf} />
          <ServiceGroup title={`Enabling Services (${enabling.length})`} services={enabling} nameOf={nameOf} />
        </div>
      )}

      {view === "by-provider" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-8)" }}>
          {Array.from(byProvider.entries()).map(([provider, list]) => (
            <ServiceGroup key={provider} title={`${provider} (${list.length})`} services={list} nameOf={nameOf} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceGroup({
  title,
  services,
  nameOf,
}: {
  title: string;
  services: ServiceRow[];
  nameOf: (id: string) => string;
}) {
  if (services.length === 0) return null;
  return (
    <div>
      <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "var(--v2-text-lg)", fontWeight: 600, color: "var(--v2-text)", margin: "0 0 var(--v2-space-4)" }}>
        {title}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--v2-space-4)" }}>
        {services.map((s) => (
          <ServiceDetailCard key={s.id} service={s} nameOf={nameOf} />
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div style={{ marginTop: "var(--v2-space-3)" }}>
      <div style={{ fontSize: "var(--v2-text-xs)", fontWeight: 600, color: "var(--v2-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--v2-text-sm)", color: "var(--v2-text)", lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function ServiceDetailCard({ service: s, nameOf }: { service: ServiceRow; nameOf: (id: string) => string }) {
  const isGap = s.type === "cvs" && !s.providerId;
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--v2-space-2)" }}>
        <div>
          <Badge tone={isGap ? "warning" : s.type === "cvs" ? "accent" : "neutral"}>
            {s.type === "cvs" ? "CVS" : "Enabling"}
            {isGap ? " · Gap" : ""}
          </Badge>
          <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "var(--v2-text-base)", fontWeight: 600, color: "var(--v2-text)", margin: "var(--v2-space-2) 0 0" }}>
            {s.name}
          </h3>
        </div>
        {s.department && <Badge tone="neutral">{s.department}</Badge>}
      </div>

      <Field label="Description" value={s.description} />
      <Field label="Recipient" value={s.recipient} />
      <Field label="Customer need" value={s.customerNeed} />
      <Field label="Target customer" value={s.targetCustomer} />
      <Field label="Outcome" value={s.outcome} />
      <Field label="Delivery model" value={s.deliveryModel} />
      <Field label="Commercial model" value={s.commercialModel} />
      <Field label="Technology" value={s.technology} />
      <Field label="Depends on" value={s.dependsOn.length ? s.dependsOn.map(nameOf).join(", ") : null} />
      <Field label="Feeds" value={s.feeds.length ? s.feeds.map(nameOf).join(", ") : null} />
      <Field label="Owner" value={s.providerName || (s.providerId ? "Assigned" : "Not assigned")} />
      <Field label="Backup" value={s.backupName || (s.backupId ? "Assigned" : "Not assigned")} />
    </Card>
  );
}
