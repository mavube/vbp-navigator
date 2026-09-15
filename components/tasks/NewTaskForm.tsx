"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, Task } from "@/components/tasks/types";

export function NewTaskForm({
  services,
  onCreated,
}: {
  services: ServiceOption[];
  onCreated: (task: Task) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, title }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create task");
      }
      const task: Task = await res.json();
      onCreated(task);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create task");
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
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        style={{ flex: "1 1 240px" }}
      />
      <Button type="submit" disabled={busy || !serviceId || !title.trim()}>
        {busy ? "Adding…" : "Add task"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
