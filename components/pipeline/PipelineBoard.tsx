"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewLeadForm } from "@/components/pipeline/NewLeadForm";
import { LeadItem } from "@/components/pipeline/LeadItem";
import type { ServiceOption, ProductOption, Lead } from "@/components/pipeline/types";

export function PipelineBoard() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      // Phase C: the price catalog fetch is best-effort and non-fatal —
      // it only feeds the optional "which product" picker, so a
      // catalog-fetch failure shouldn't block Pipeline from loading.
      const [servicesRes, leadsRes, catalogRes] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/leads", { cache: "no-store" }),
        fetch("/api/price-catalog", { cache: "no-store" }).catch(() => null),
      ]);
      if (!servicesRes.ok || !leadsRes.ok) throw new Error("failed to load");
      setServices(await servicesRes.json());
      setLeads(await leadsRes.json());
      if (catalogRes && catalogRes.ok) setProducts(await catalogRes.json());
      setError("");
    } catch {
      setError("Couldn't load the pipeline — try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function serviceName(serviceId: string) {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }

  function productName(productServiceId: string | null) {
    if (!productServiceId) return null;
    return products.find((p) => p.id === productServiceId)?.name ?? null;
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  const active = leads.filter((l) => l.stage !== "admitted" && l.stage !== "lost");
  const closed = leads.filter((l) => l.stage === "admitted" || l.stage === "lost");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewLeadForm services={services} products={products} onCreated={(lead) => setLeads((prev) => [lead, ...prev])} />
      </Card>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      )}

      <div>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>No active leads.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {active.map((lead) => (
              <LeadItem
                key={lead.id}
                lead={lead}
                serviceName={serviceName(lead.serviceId)}
                productName={productName(lead.productServiceId)}
                onStageChange={(stage) =>
                  setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)))
                }
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
            {closed.map((lead) => (
              <LeadItem
                key={lead.id}
                lead={lead}
                serviceName={serviceName(lead.serviceId)}
                productName={productName(lead.productServiceId)}
                onStageChange={(stage) =>
                  setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
