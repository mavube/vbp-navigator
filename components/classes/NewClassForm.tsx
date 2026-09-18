"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, ProductOption, Class } from "@/components/classes/types";

export function NewClassForm({
  services,
  products,
  onCreated,
}: {
  services: ServiceOption[];
  products: ProductOption[];
  onCreated: (cls: Class) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [productServiceId, setProductServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeProducts = products.filter((p) => p.active);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          productServiceId: productServiceId || undefined,
          title,
          scheduledDate: scheduledDate || undefined,
          instructorName,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't schedule class");
      }
      const cls: Class = await res.json();
      onCreated(cls);
      setProductServiceId("");
      setTitle("");
      setScheduledDate("");
      setInstructorName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't schedule class");
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
        placeholder="Class title (e.g. PMP Master Class — Oct cohort)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        style={{ flex: "1 1 260px" }}
      />
      <Input
        type="date"
        value={scheduledDate}
        onChange={(e) => setScheduledDate(e.target.value)}
        style={{ flex: "1 1 160px" }}
      />
      <Input
        placeholder="Instructor (optional)"
        value={instructorName}
        onChange={(e) => setInstructorName(e.target.value)}
        style={{ flex: "1 1 180px" }}
      />
      <Button type="submit" disabled={busy || !serviceId || !title.trim()}>
        {busy ? "Scheduling…" : "Schedule class"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
