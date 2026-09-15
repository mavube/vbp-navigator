"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewEntryForm } from "@/components/compensation/NewEntryForm";
import { EntryItem } from "@/components/compensation/EntryItem";
import type { ServiceOption, CompensationEntry } from "@/components/compensation/types";

export function CompensationBoard() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [entries, setEntries] = useState<CompensationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      const [servicesRes, entriesRes] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/compensation", { cache: "no-store" }),
      ]);
      if (!servicesRes.ok || !entriesRes.ok) throw new Error("failed to load");
      setServices(await servicesRes.json());
      setEntries(await entriesRes.json());
      setError("");
    } catch {
      setError("Couldn't load compensation entries — try refreshing.");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewEntryForm services={services} onCreated={(entry) => setEntries((prev) => [entry, ...prev])} />
      </Card>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog (Compensation
          Earning Service is one of the 5 Enabling Services in it).
        </p>
      )}

      {entries.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>No compensation entries yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {entries.map((entry) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              serviceName={serviceName(entry.serviceId)}
              onFinalized={(updated) => setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
