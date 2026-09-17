"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { MemoryEntryRecord, MemoryType, ServiceOption } from "@/components/memory/types";

const TYPE_LABELS: Record<MemoryType, string> = {
  decision: "Decision",
  lesson: "Lesson",
};

export function NewMemoryEntryForm({
  services,
  onCreated,
}: {
  services: ServiceOption[];
  onCreated: (entry: MemoryEntryRecord) => void;
}) {
  const [type, setType] = useState<MemoryType>("lesson");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          body: body.trim(),
          serviceId: serviceId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Couldn't save this entry");
      }
      const entry: MemoryEntryRecord = await res.json();
      onCreated(entry);
      setTitle("");
      setBody("");
      setServiceId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <select value={type} onChange={(e) => setType(e.target.value as MemoryType)} className="v2-input" style={{ maxWidth: 180 }}>
          {(Object.keys(TYPE_LABELS) as MemoryType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="v2-input" style={{ maxWidth: 260 }}>
          <option value="">Org-wide (not about one service)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <Input placeholder="What happened, or what was decided" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <textarea
        className="v2-input"
        rows={3}
        placeholder="Why it matters, what to do differently next time — optional"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div>
        <Button type="submit" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Add entry"}
        </Button>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", margin: 0 }}>{error}</p>}
    </form>
  );
}
