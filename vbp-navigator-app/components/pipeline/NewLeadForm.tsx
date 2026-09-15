"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, Lead } from "@/components/pipeline/types";

export function NewLeadForm({
  services,
  onCreated,
}: {
  services: ServiceOption[];
  onCreated: (lead: Lead) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, contactName, contactEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't add lead");
      }
      const lead: Lead = await res.json();
      onCreated(lead);
      setContactName("");
      setContactEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
      <select
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        required
        className="v2-input"
        style={{ maxWidth: 260 }}
      >
        <option value="" disabled>
          Service…
        </option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Input
        placeholder="Contact name"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        required
        style={{ flex: "1 1 200px" }}
      />
      <Input
        type="email"
        placeholder="Email (optional)"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        style={{ flex: "1 1 200px" }}
      />
      <Button type="submit" disabled={busy || !serviceId || !contactName.trim()}>
        {busy ? "Adding…" : "Add lead"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
