"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { Spinner } from "@/components/ui/Spinner";
import type { Blocker, BlockerImpact, ServiceOption, Task } from "@/components/tasks/types";

const IMPACT_TONE: Record<BlockerImpact, "neutral" | "accent" | "warning" | "danger"> = {
  low: "neutral",
  medium: "accent",
  high: "warning",
  critical: "danger",
};
const IMPACT_LABEL: Record<BlockerImpact, string> = {
  low: "Low impact",
  medium: "Medium impact",
  high: "High impact",
  critical: "Critical",
};

// v3.0 Phase 6 (§11) — blockers as first-class, traceable objects
// (owner, impact, required action) instead of inferring "this is
// blocked" from a task sitting in "open" too long. Anyone can report
// one (same open-creation model as Tasks/Service Requests); resolving
// is gated to that blocker's service owner/contributor/org admin,
// enforced server-side in app/api/blockers/[id]/route.ts.
export function BlockersPanel({
  services,
  tasks,
  blockers,
  serviceName,
  onCreated,
  onResolved,
}: {
  services: ServiceOption[];
  tasks: Task[];
  blockers: Blocker[];
  serviceName: (serviceId: string) => string;
  onCreated: (b: Blocker) => void;
  // v3.0 roadmap Phase 9 — resolving now returns whether it auto-
  // unblocked a linked task (see app/api/blockers/[id]/route.ts), so
  // the caller gets the full response instead of just the blocker id.
  onResolved: (result: { id: string; unblockedTaskId?: string | null; unblockedTaskStatus?: "in_progress" | null }) => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [impact, setImpact] = useState<BlockerImpact>("medium");
  const [requiredAction, setRequiredAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const open = blockers.filter((b) => b.status === "open");
  const resolved = blockers.filter((b) => b.status === "resolved");
  const tasksForService = tasks.filter((t) => !serviceId || t.serviceId === serviceId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, taskId: taskId || null, title, ownerName, impact, requiredAction }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't report blocker");
      }
      const blocker: Blocker = await res.json();
      onCreated(blocker);
      setTitle("");
      setTaskId("");
      setOwnerName("");
      setImpact("medium");
      setRequiredAction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't report blocker");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string) {
    setResolvingId(id);
    const res = await fetch(`/api/blockers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    setResolvingId(null);
    if (res.ok) {
      const result = await res.json().catch(() => ({ id }));
      onResolved(result);
    }
  }

  return (
    <Section title="Blockers" description="First-class, traceable — who owns unblocking it, how big the impact is, and what actually needs to happen.">
      <form onSubmit={submit} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setTaskId(""); }} required className="v2-input" style={{ maxWidth: 220 }}>
          <option value="" disabled>Service…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="v2-input" style={{ maxWidth: 200 }}>
          <option value="">Not tied to a task</option>
          {tasksForService.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <input placeholder="What's blocked" value={title} onChange={(e) => setTitle(e.target.value)} required className="v2-input" style={{ flex: "1 1 200px" }} />
        <input placeholder="Owner (who can unblock it)" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="v2-input" style={{ flex: "1 1 160px" }} />
        <select value={impact} onChange={(e) => setImpact(e.target.value as BlockerImpact)} className="v2-input" style={{ maxWidth: 150 }}>
          <option value="low">Low impact</option>
          <option value="medium">Medium impact</option>
          <option value="high">High impact</option>
          <option value="critical">Critical</option>
        </select>
        <input
          placeholder="Required action to clear it"
          value={requiredAction}
          onChange={(e) => setRequiredAction(e.target.value)}
          className="v2-input"
          style={{ flex: "1 1 220px" }}
        />
        <button
          type="submit"
          disabled={busy || resolvingId !== null || !serviceId || !title.trim()}
          className={`v2-btn v2-btn-primary ${busy ? "v2-btn-busy" : ""}`}
        >
          {busy && <Spinner />}
          {busy ? "Reporting…" : "Report blocker"}
        </button>
        {error && <p style={{ color: "var(--v2-danger)", width: "100%", margin: 0 }}>{error}</p>}
      </form>

      {open.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>No open blockers.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          {open.map((b) => {
            const linkedTask = b.taskId ? tasks.find((t) => t.id === b.taskId) : null;
            return (
              <div key={b.id} className="v2-card" style={{ padding: "var(--v2-space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.title}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
                      {serviceName(b.serviceId)}
                      {linkedTask ? ` · blocking "${linkedTask.title}"` : ""}
                      {b.ownerName ? ` · owner: ${b.ownerName}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
                    <Badge tone={IMPACT_TONE[b.impact]}>{IMPACT_LABEL[b.impact]}</Badge>
                    <button
                      type="button"
                      onClick={() => resolve(b.id)}
                      disabled={resolvingId !== null || busy}
                      className={`v2-btn v2-btn-secondary ${resolvingId === b.id ? "v2-btn-busy" : ""}`}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {resolvingId === b.id && <Spinner size={11} />}
                      {resolvingId === b.id ? "Resolving…" : "Mark resolved"}
                    </button>
                  </div>
                </div>
                {b.requiredAction && <p style={{ fontSize: "0.85rem", margin: "8px 0 0" }}>Needed to clear it: {b.requiredAction}</p>}
                {b.description && <p style={{ fontSize: "0.85rem", color: "var(--v2-text-muted)", margin: "4px 0 0" }}>{b.description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "var(--v2-text-muted)" }}>Resolved ({resolved.length})</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)", marginTop: "var(--v2-space-2)" }}>
            {resolved.map((b) => (
              <div key={b.id} style={{ fontSize: "0.85rem", color: "var(--v2-text-faint)", padding: "6px 0", borderBottom: "1px solid var(--v2-border)" }}>
                {b.title} — {serviceName(b.serviceId)} — resolved
              </div>
            ))}
          </div>
        </details>
      )}
    </Section>
  );
}
