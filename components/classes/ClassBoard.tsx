"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewClassForm } from "@/components/classes/NewClassForm";
import { ClassItem } from "@/components/classes/ClassItem";
import type { ServiceOption, ProductOption, Class } from "@/components/classes/types";

export function ClassBoard() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      // Phase C: catalog fetch is best-effort/non-fatal, same as
      // components/pipeline/PipelineBoard.tsx — it only feeds the
      // optional product picker.
      const [servicesRes, classesRes, catalogRes] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/classes", { cache: "no-store" }),
        fetch("/api/price-catalog", { cache: "no-store" }).catch(() => null),
      ]);
      if (!servicesRes.ok || !classesRes.ok) throw new Error("failed to load");
      setServices(await servicesRes.json());
      setClasses(await classesRes.json());
      if (catalogRes && catalogRes.ok) setProducts(await catalogRes.json());
      setError("");
    } catch {
      setError("Couldn't load classes — try refreshing.");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewClassForm services={services} products={products} onCreated={(cls) => setClasses((prev) => [cls, ...prev])} />
      </Card>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      )}

      {classes.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>No classes scheduled yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {classes.map((cls) => (
            <ClassItem
              key={cls.id}
              cls={cls}
              serviceName={serviceName(cls.serviceId)}
              productName={productName(cls.productServiceId)}
              onStatusChange={(status) =>
                setClasses((prev) => prev.map((c) => (c.id === cls.id ? { ...c, status } : c)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
