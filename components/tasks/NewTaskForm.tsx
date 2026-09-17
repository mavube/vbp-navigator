"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceOption, Task } from "@/components/tasks/types";

export function NewTaskForm({
  services,
  tasks,
  onCreated,
}: {
  services: ServiceOption[];
  // v3.0 roadmap Phase 9 — the candidate pool for the dependency picker
  // below. Optional so this form still works anywhere it might be
  // reused without the full task list in hand; the picker just doesn't
  // render then.
  tasks?: Task[];
  onCreated: (task: Task) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [showDeps, setShowDeps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Dependencies only make sense within the same service — a candidate
  // list scoped any wider would let someone pick a prerequisite from an
  // unrelated part of the org, which is more confusing than useful.
  const candidates = (tasks ?? []).filter((t) => t.serviceId === serviceId);

  function toggleDependency(id: string) {
    setDependencies((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, title, assigneeName, startDate, dueDate, dependencies }),
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
      setDependencies([]);
      setShowDeps(false);
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
      {candidates.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDeps((v) => !v)}
          className="v2-btn v2-btn-secondary"
          style={{ padding: "8px 12px", fontSize: "0.8rem", alignSelf: "flex-end" }}
        >
          {showDeps ? "Hide dependencies" : dependencies.length > 0 ? `Depends on (${dependencies.length})` : "Depends on…"}
        </button>
      )}
      <Button type="submit" loading={busy} disabled={!serviceId || !title.trim()} style={{ alignSelf: "flex-end" }}>
        {busy ? "Adding…" : "Add task"}
      </Button>
      {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}

      {showDeps && candidates.length > 0 && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "var(--v2-space-3)",
            background: "var(--v2-surface-sunken)",
            borderRadius: "var(--v2-radius-sm)",
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
            This task can&apos;t start or finish until these are done:
          </p>
          {candidates.map((t) => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
              <input type="checkbox" checked={dependencies.includes(t.id)} onChange={() => toggleDependency(t.id)} />
              {t.title}
            </label>
          ))}
        </div>
      )}
    </form>
  );
}
