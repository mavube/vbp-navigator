"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import { CustomerItem } from "@/components/customers/CustomerItem";
import type { Customer, Engagement, ServiceOption, ProductOption } from "@/components/customers/types";

// v3.0 roadmap Phase 4 (§9, Customer intelligence) — the first view
// onto the Customer/Engagement entities admitting a Lead now creates
// (see app/api/leads/[id]/route.ts). v3.0 roadmap Phase 10 (Cluster C)
// closed the gap the original phase's comment flagged as "real future
// work" — editing a customer's own details is no longer read-only (see
// CustomerItem.tsx), and a customer no longer has to arrive via Pipeline
// at all (see NewCustomerForm.tsx below). Phase E (Customer Workspace
// rebuild) added the real per-customer detail route (/customers/[id] —
// see CustomerItem.tsx's "Open" link) this flat list used to be
// standing in for, via a ?highlight= scroll-to-card hack now removed.
export function CustomersWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/customers", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      // Phase C: best-effort — only feeds the engagement product label.
      fetch("/api/price-catalog", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])).catch(() => []),
    ])
      .then(([servicesData, customersData, catalogData]) => {
        setServices(servicesData);
        setCustomers(customersData.customers);
        setEngagements(customersData.engagements);
        setProducts(catalogData);
      })
      .catch(() => setError("Couldn't load customers — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

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
          is marked won.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {customers.map((c) => (
            <CustomerItem
              key={c.id}
              customer={c}
              engagements={engagements}
              services={services}
              products={products}
              onUpdated={(patch) => setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
