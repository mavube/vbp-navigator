"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, ProductOption, Lead } from "@/components/pipeline/types";

export function NewLeadForm({
  services,
  products,
  onCreated,
}: {
  services: ServiceOption[];
  products: ProductOption[];
  onCreated: (lead: Lead) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [productServiceId, setProductServiceId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeProducts = products.filter((p) => p.active);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, productServiceId: productServiceId || undefined, contactName, contactEmail, contactPhone, notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't add lead");
      }
      const lead: Lead = await res.json();
      onCreated(lead);
      setProductServiceId("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setNotes("");
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
      {activeProducts.length > 0 && (
        <select
          value={productServiceId}
          onChange={(e) => setProductServiceId(e.target.value)}
          className="v2-input"
          style={{ maxWidth: 260 }}
        >
          <option value="">Product/offering (optional)…</option>
          {activeProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
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
      <Input
        type="tel"
        placeholder="Phone (optional)"
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        style={{ flex: "1 1 160px" }}
      />
      <textarea
        className="v2-input"
        rows={2}
        placeholder="Notes (optional) — context worth keeping with this lead"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ flex: "1 1 100%", resize: "vertical" }}
      />
      <Button type="submit" disabled={busy || !serviceId || !contactName.trim()}>
        {busy ? "Adding…" : "Add lead"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
