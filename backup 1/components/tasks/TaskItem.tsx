"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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

export function TaskItem({
  task,
  serviceName,
  onStatusChange,
}: {
  task: Task;
  serviceName: string;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const [error, setError] = useState("");

  async function setStatus(status: TaskStatus) {
    setError("");
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
  }

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{task.title}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName}
            {task.assigneeName ? ` · ${task.assigneeName}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          {(["open", "in_progress", "done"] as TaskStatus[])
            .filter((s) => s !== task.status)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="v2-btn v2-btn-secondary"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                Mark {STATUS_LABEL[s].toLowerCase()}
              </button>
            ))}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}

      <CommentThread entityType="task" entityId={task.id} />
    </Card>
  );
}
