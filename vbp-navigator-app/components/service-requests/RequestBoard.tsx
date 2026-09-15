"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewRequestForm } from "@/components/service-requests/NewRequestForm";
import { RequestItem } from "@/components/service-requests/RequestItem";
import type { ServiceOption, ServiceRequest } from "@/components/service-requests/types";

export function RequestBoard() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      const [servicesRes, requestsRes] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/service-requests", { cache: "no-store" }),
      ]);
      if (!servicesRes.ok || !requestsRes.ok) throw new Error("failed to load");
      setServices(await servicesRes.json());
      setRequests(await requestsRes.json());
      setError("");
    } catch {
      setError("Couldn't load requests — try refreshing.");
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

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  const open = requests.filter((r) => r.status !== "closed");
  const closed = requests.filter((r) => r.status === "closed");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewRequestForm services={services} onCreated={(req) => setRequests((prev) => [req, ...prev])} />
      </Card>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      )}

      <div>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>No open requests.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {open.map((req) => (
              <RequestItem
                key={req.id}
                request={req}
                serviceName={serviceName(req.serviceId)}
                onStatusChange={(status) => setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status } : r)))}
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
            {closed.map((req) => (
              <RequestItem
                key={req.id}
                request={req}
                serviceName={serviceName(req.serviceId)}
                onStatusChange={(status) => setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status } : r)))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
