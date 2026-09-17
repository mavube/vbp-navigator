"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { NewMemoryEntryForm } from "@/components/memory/NewMemoryEntryForm";
import { MemoryEntryItem } from "@/components/memory/MemoryEntryItem";
import type { MemoryEntryRecord, ServiceOption } from "@/components/memory/types";

// v3.0 roadmap Phase 9 (Organizational Memory, §17), Phase 13 here.
// Pulls services (for the entry-service picker and each entry's
// display name) and the entries themselves, same two-fetch shape
// DocumentsWorkspace uses.
export function MemoryWorkspace() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [entries, setEntries] = useState<MemoryEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/memory", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([servicesData, entriesData]) => {
        setServices(servicesData);
        setEntries(entriesData);
        setError("");
      })
      .catch(() => setError("Couldn't load Memory — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Section title="Add an entry" description="A decision that got made, or a lesson worth not re-learning. Short is fine.">
        <NewMemoryEntryForm services={services} onCreated={(entry) => setEntries((prev) => [entry, ...prev])} />
      </Section>

      <Section title={`Log (${entries.length})`} description="Newest first.">
        {entries.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>Nothing logged yet — the first entry above starts the record.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {entries.map((entry) => (
              <MemoryEntryItem key={entry.id} entry={entry} services={services} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
