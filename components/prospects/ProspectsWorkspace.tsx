"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ProspectItem } from "@/components/prospects/ProspectItem";
import { NewProspectForm } from "@/components/prospects/NewProspectForm";
import type { Prospect, ServiceOption, ProductOption } from "@/components/prospects/types";

// v3.0 roadmap Phase 4 — the staff-facing review queue for everyone who
// came in through /apply or /assess. Same Active/Closed split shape as
// PipelineBoard: "Needs review" (new/reviewed) vs. "Closed"
// (promoted/declined), since a promoted prospect's ongoing story lives
// on Pipeline (as the Lead it became) and eventually /customers, not
// here.
export function ProspectsWorkspace() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/prospects", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      // Phase C: best-effort — the product picker is optional, so a
      // catalog-fetch failure shouldn't block Prospects from loading.
      fetch("/api/price-catalog", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])).catch(() => []),
    ])
      .then(([servicesData, prospectsData, catalogData]) => {
        setServices(servicesData);
        setProspects(prospectsData);
        setProducts(catalogData);
      })
      .catch(() => setError("Couldn't load prospects — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function serviceName(serviceId: string | null): string | null {
    if (!serviceId) return null;
    return services.find((s) => s.id === serviceId)?.name ?? null;
  }

  function productName(productServiceId: string | null): string | null {
    if (!productServiceId) return null;
    return products.find((p) => p.id === productServiceId)?.name ?? null;
  }

  function handleChange(id: string, updated: Partial<Prospect>) {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  const needsReview = prospects.filter((p) => p.status === "new" || p.status === "reviewed");
  const closed = prospects.filter((p) => p.status === "promoted" || p.status === "declined");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewProspectForm services={services} products={products} onCreated={(p) => setProspects((prev) => [p, ...prev])} />
      </Card>

      {prospects.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          Nobody has come in through the public application or assessment forms yet.
        </p>
      )}

      <div>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Needs review ({needsReview.length})
        </h2>
        {needsReview.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>Nothing waiting on review.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {needsReview.map((p) => (
              <ProspectItem
                key={p.id}
                prospect={p}
                services={services}
                serviceName={serviceName(p.serviceId)}
                productName={productName(p.productServiceId)}
                onChange={(updated) => handleChange(p.id, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
            Closed ({closed.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {closed.map((p) => (
              <ProspectItem
                key={p.id}
                prospect={p}
                services={services}
                serviceName={serviceName(p.serviceId)}
                productName={productName(p.productServiceId)}
                onChange={(updated) => handleChange(p.id, updated)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
