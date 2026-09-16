"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Customer, Engagement, ServiceOption } from "@/components/customers/types";

const ENGAGEMENT_TONE: Record<string, "accent" | "success" | "neutral"> = {
  active: "accent",
  completed: "success",
  paused: "neutral",
};

// v3.0 roadmap Phase 4 (§9, Customer intelligence) — the first view
// onto the Customer/Engagement entities admitting a Lead now creates
// (see app/api/leads/[id]/route.ts). Deliberately read-only for this
// phase: editing a customer's own details, or an engagement's status/
// outcome note, is real future work (see the build guide's "not done
// yet" list) — this phase is about the entities existing and being
// visible at all, not a full CRM.
export function CustomersWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/customers", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([servicesData, customersData]) => {
        setServices(servicesData);
        setCustomers(customersData.customers);
        setEngagements(customersData.engagements);
      })
      .catch(() => setError("Couldn't load customers — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function serviceName(serviceId: string): string {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  if (customers.length === 0) {
    return (
      <p style={{ color: "var(--v2-text-muted)" }}>
        No customers yet — a customer record is created automatically the first time a lead on Pipeline is marked
        admitted.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
      {customers.map((c) => {
        const theirEngagements = engagements.filter((e) => e.customerId === c.id);
        return (
          <Card key={c.id} style={{ padding: "var(--v2-space-4)" }}>
            <div style={{ fontWeight: 600 }}>{c.fullName}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
              {[c.email, c.phone, c.organizationName].filter(Boolean).join(" · ") || "No contact details on file"}
            </div>
            {theirEngagements.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "var(--v2-space-3)" }}>
                {theirEngagements.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "var(--v2-space-2)", fontSize: "0.85rem" }}>
                    <Badge tone={ENGAGEMENT_TONE[e.status] ?? "neutral"}>{e.status}</Badge>
                    <span>{serviceName(e.serviceId)}</span>
                    <span style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>
                      since {new Date(e.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
