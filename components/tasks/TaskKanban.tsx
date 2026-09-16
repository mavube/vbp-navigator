"use client";

import { Badge } from "@/components/ui/Badge";
import type { Task, TaskStatus } from "@/components/tasks/types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

// v3.0 Phase 6 — one of the four work views (List/Kanban/Gantt/
// Calendar). No drag-and-drop library: a compact "→" button per card
// advances it to the next column, same click-to-change interaction
// TaskItem's status buttons already use elsewhere in this module, just
// laid out as three columns instead of one flat list.
export function TaskKanban({
  tasks,
  serviceName,
  blockedTaskIds,
  onStatusChange,
}: {
  tasks: Task[];
  serviceName: (serviceId: string) => string;
  blockedTaskIds: Set<string>;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <div className="v2-kanban-grid">
      {COLUMNS.map((col, colIdx) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px var(--v2-space-2)",
                borderBottom: "2px solid var(--v2-border)",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{col.label}</span>
              <Badge tone="neutral">{colTasks.length}</Badge>
            </div>
            {colTasks.length === 0 ? (
              <p style={{ color: "var(--v2-text-faint)", fontSize: "0.8rem", padding: "0 var(--v2-space-2)" }}>Nothing here.</p>
            ) : (
              colTasks.map((task) => (
                <div
                  key={task.id}
                  className="v2-card"
                  style={{ padding: "var(--v2-space-3)", display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{task.title}</span>
                    {blockedTaskIds.has(task.id) && <Badge tone="danger">Blocked</Badge>}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)" }}>
                    {serviceName(task.serviceId)}
                    {task.assigneeName ? ` · ${task.assigneeName}` : ""}
                  </span>
                  {colIdx < COLUMNS.length - 1 && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, COLUMNS[colIdx + 1].status)}
                      className="v2-btn v2-btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.7rem", alignSelf: "flex-start" }}
                    >
                      Move to {COLUMNS[colIdx + 1].label.toLowerCase()} →
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
