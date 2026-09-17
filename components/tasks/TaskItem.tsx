"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import { PRIORITY_BADGE_TONE, PRIORITY_LABEL, PRIORITY_ORDER } from "@/components/tasks/priority";
import type { Task, TaskPriority, TaskStatus } from "@/components/tasks/types";

const STATUS_TONE: Record<TaskStatus, "neutral" | "accent" | "success"> = {
  open: "neutral",
  in_progress: "accent",
  done: "success",
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskItem({
  task,
  serviceName,
  openBlockerCount = 0,
  allTasks = [],
  onStatusChange,
  onDatesChange,
  onPriorityChange,
}: {
  task: Task;
  serviceName: string;
  openBlockerCount?: number;
  // v3.0 roadmap Phase 9 — the full task list, so this card can resolve
  // its own `dependencies` ids into real titles/statuses and block the
  // advance buttons client-side (the server enforces the same rule
  // regardless — see app/api/tasks/[id]/route.ts — this is just so the
  // person doesn't have to click "Mark in progress" to find out).
  allTasks?: Task[];
  onStatusChange: (status: TaskStatus) => void;
  onDatesChange?: (dates: { startDate: string | null; dueDate: string | null }) => void;
  onPriorityChange?: (priority: TaskPriority) => void;
}) {
  const [error, setError] = useState("");
  const [editingDates, setEditingDates] = useState(false);
  const [startDate, setStartDate] = useState(task.startDate ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [savingDates, setSavingDates] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [savingPriority, setSavingPriority] = useState(false);
  const busy = pendingStatus !== null || savingDates || savingPriority;

  const dependencyTasks = task.dependencies
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);
  const unmetDependencies = dependencyTasks.filter((t) => t.status !== "done");

  async function setStatus(status: TaskStatus) {
    setError("");
    setPendingStatus(status);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onStatusChange(status);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't update status");
      }
    } finally {
      setPendingStatus(null);
    }
  }

  async function setPriority(priority: TaskPriority) {
    if (priority === task.priority) return;
    setSavingPriority(true);
    setError("");
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    setSavingPriority(false);
    if (res.ok) {
      onPriorityChange?.(priority);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't update priority");
    }
  }

  async function saveDates() {
    setSavingDates(true);
    setError("");
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: startDate || null, dueDate: dueDate || null }),
    });
    setSavingDates(false);
    if (res.ok) {
      onDatesChange?.({ startDate: startDate || null, dueDate: dueDate || null });
      setEditingDates(false);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't update dates");
    }
  }

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {task.title}
            <Badge tone={PRIORITY_BADGE_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
            {openBlockerCount > 0 && <Badge tone="danger">Blocked ({openBlockerCount})</Badge>}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName}
            {task.assigneeName ? ` · ${task.assigneeName}` : ""}
            {task.startDate || task.dueDate ? " · " : ""}
            {task.startDate ? `starts ${fmtDate(task.startDate)}` : ""}
            {task.startDate && task.dueDate ? " → " : ""}
            {task.dueDate ? `due ${fmtDate(task.dueDate)}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          {(["open", "in_progress", "done"] as TaskStatus[])
            .filter((s) => s !== task.status)
            .map((s) => {
              const blockedByDeps = s !== "open" && unmetDependencies.length > 0;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  disabled={busy || blockedByDeps}
                  title={blockedByDeps ? `Waiting on: ${unmetDependencies.map((t) => t.title).join(", ")}` : undefined}
                  className={`v2-btn v2-btn-secondary ${pendingStatus === s ? "v2-btn-busy" : ""}`}
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  {pendingStatus === s && <Spinner />}
                  {pendingStatus === s ? "Marking…" : `Mark ${STATUS_LABEL[s].toLowerCase()}`}
                </button>
              );
            })}
          <button
            type="button"
            onClick={() => setEditingDates((v) => !v)}
            disabled={busy}
            className="v2-btn v2-btn-secondary"
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            {editingDates ? "Cancel" : "Set dates"}
          </button>
          <select
            value={task.priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            disabled={busy}
            className="v2-input"
            aria-label="Priority"
            title="Priority"
            style={{ padding: "3px 6px", fontSize: "0.75rem", width: "auto" }}
          >
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {dependencyTasks.length > 0 && (
        <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)", marginTop: "8px" }}>
          Depends on:{" "}
          {dependencyTasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ", "}
              <span style={{ color: t.status === "done" ? "var(--v2-success)" : "var(--v2-text-muted)" }}>
                {t.title} {t.status === "done" ? "✓" : "○"}
              </span>
            </span>
          ))}
        </div>
      )}

      {editingDates && (
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "flex-end", marginTop: "var(--v2-space-3)", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
            Start
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="v2-input" style={{ width: 150 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
            Due
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="v2-input" style={{ width: 150 }} />
          </label>
          <button
            type="button"
            onClick={saveDates}
            disabled={busy}
            className={`v2-btn v2-btn-primary ${savingDates ? "v2-btn-busy" : ""}`}
            style={{ padding: "8px 14px", fontSize: "0.8rem" }}
          >
            {savingDates && <Spinner />}
            {savingDates ? "Saving…" : "Save dates"}
          </button>
        </div>
      )}

      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}

      <CommentThread entityType="task" entityId={task.id} />
    </Card>
  );
}
