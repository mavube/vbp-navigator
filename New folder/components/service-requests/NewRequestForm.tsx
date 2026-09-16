"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, ServiceRequest, RequestType, RequestPriority } from "@/components/service-requests/types";

export function NewRequestForm({
  services,
  onCreated,
}: {
  services: ServiceOption[];
  onCreated: (req: ServiceRequest) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [type, setType] = useState<RequestType>("request");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, type, priority, title }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't submit request");
      }
      const req: ServiceRequest = await res.json();
      onCreated(req);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
      <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="v2-input" style={{ maxWidth: 220 }}>
        <option value="" disabled>Service…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select value={type} onChange={(e) => setType(e.target.value as RequestType)} className="v2-input" style={{ maxWidth: 130 }}>
        <option value="request">Request</option>
        <option value="incident">Incident</option>
      </select>
      <select value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)} className="v2-input" style={{ maxWidth: 130 }}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ flex: "1 1 200px" }} />
      <Button type="submit" disabled={busy || !serviceId || !title.trim()}>
        {busy ? "Submitting…" : "Submit"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
