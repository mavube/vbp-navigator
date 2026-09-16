"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import type { Task, TaskStatus } from "@/components/tasks/types";

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
  onStatusChange,
  onDatesChange,
}: {
  task: Task;
  serviceName: string;
  openBlockerCount?: number;
  onStatusChange: (status: TaskStatus) => void;
  onDatesChange?: (dates: { startDate: string | null; dueDate: string | null }) => void;
}) {
  const [error, setError] = useState("");
  const [editingDates, setEditingDates] = useState(false);
  const [startDate, setStartDate] = useState(task.startDate ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [savingDates, setSavingDates] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const busy = pendingStatus !== null || savingDates;

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
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={busy}
                className={`v2-btn v2-btn-secondary ${pendingStatus === s ? "v2-btn-busy" : ""}`}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {pendingStatus === s && <Spinner />}
                {pendingStatus === s ? "Marking…" : `Mark ${STATUS_LABEL[s].toLowerCase()}`}
              </button>
            ))}
          <button
            type="button"
            onClick={() => setEditingDates((v) => !v)}
            disabled={busy}
            className="v2-btn v2-btn-secondary"
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            {editingDates ? "Cancel" : "Set dates"}
          </button>
        </div>
      </div>

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
