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
  const [assigneeName, setAssigneeName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
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
        body: JSON.stringify({ serviceId, title, assigneeName, startDate, dueDate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create task");
      }
      const task: Task = await res.json();
      onCreated(task);
      setTitle("");
      setAssigneeName("");
      setStartDate("");
      setDueDate("");
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
      <Input
        placeholder="Assignee (optional)"
        value={assigneeName}
        onChange={(e) => setAssigneeName(e.target.value)}
        style={{ flex: "1 1 160px" }}
      />
      <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
        Start (optional)
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 150 }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
        Due (optional)
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: 150 }} />
      </label>
      <Button type="submit" disabled={busy || !serviceId || !title.trim()} style={{ alignSelf: "flex-end" }}>
        {busy ? "Adding…" : "Add task"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
