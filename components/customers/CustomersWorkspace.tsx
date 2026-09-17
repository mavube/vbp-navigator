"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import { CustomerItem } from "@/components/customers/CustomerItem";
import type { Customer, Engagement, ServiceOption } from "@/components/customers/types";

// v3.0 roadmap Phase 4 (§9, Customer intelligence) — the first view
// onto the Customer/Engagement entities admitting a Lead now creates
// (see app/api/leads/[id]/route.ts). v3.0 roadmap Phase 10 (Cluster C)
// closed the gap the original phase's comment flagged as "real future
// work" — editing a customer's own details is no longer read-only (see
// CustomerItem.tsx), and a customer no longer has to arrive via Pipeline
// at all (see NewCustomerForm.tsx below).
export function CustomersWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Quick win: lead admission (LeadItem.tsx) deep-links here with
  // ?highlight=<customerId> instead of a plain "see Customers" link —
  // there's no per-customer detail page/route to deep-link to yet (a
  // real gap, tracked in the enhancement backlog's Cluster C), so this
  // scrolls to and highlights the right card on this list instead of
  // pretending a full detail route exists.
  const highlightId = useSearchParams().get("highlight");

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

  useEffect(() => {
    if (!highlightId || customers.length === 0) return;
    const el = document.getElementById(`customer-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, customers]);

  function serviceName(serviceId: string): string {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewCustomerForm onCreated={(c) => setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]))} />
      </Card>

      {customers.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No customers yet — add one above, or a record is created automatically the first time a lead on Pipeline
          is marked admitted.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {customers.map((c) => (
            <CustomerItem
              key={c.id}
              customer={c}
              engagements={engagements}
              services={services}
              highlighted={highlightId === c.id}
              onUpdated={(patch) => setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
