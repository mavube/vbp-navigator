"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { PRIORITY_COLOR, PRIORITY_LABEL, PRIORITY_ORDER } from "@/components/tasks/priority";
import type { Task, TaskPriority, TaskStatus } from "@/components/tasks/types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

type GroupBy = "none" | "service" | "assignee";
const UNASSIGNED = "Unassigned";

// v3.0 roadmap Phase 11 (Cluster D) — closes three gaps the audit
// named on this exact view: "no drag-and-drop (button-only column
// advance), no filter/group by service or assignee, no priority field
// on Task at all (so no color coding by urgency)." The advance button
// from Phase 6 stays (dragging is a nice-to-have, not everyone's
// input method, and this is a business tool, not a game) — it's now
// one of two ways to move a card, not the only one.
export function TaskKanban({
  tasks,
  serviceName,
  blockedTaskIds,
  onStatusChange,
}: {
  tasks: Task[];
  serviceName: (serviceId: string) => string;
  blockedTaskIds: Set<string>;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
}) {
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  // v3.0 roadmap Phase 9 carried this forward as a known gap: dragging
  // or clicking a card into a status the server rejects (e.g. an
  // unfinished dependency) used to fail silently here, unlike the List
  // view's inline error. Closed now that Phase 11 is touching this file
  // anyway — see TaskBoard.tsx's patchStatus comment.
  const [error, setError] = useState("");

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of tasks) names.add(t.assigneeName.trim() || UNASSIGNED);
    return Array.from(names).sort();
  }, [tasks]);

  const filtered = assigneeFilter
    ? tasks.filter((t) => (t.assigneeName.trim() || UNASSIGNED) === assigneeFilter)
    : tasks;

  async function move(taskId: string, status: TaskStatus) {
    setMovingTaskId(taskId);
    setError("");
    try {
      await onStatusChange(taskId, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move this task");
    } finally {
      setMovingTaskId(null);
    }
  }

  function handleDrop(status: TaskStatus) {
    setDragOverStatus(null);
    if (!dragTaskId) return;
    const task = filtered.find((t) => t.id === dragTaskId);
    setDragTaskId(null);
    if (!task || task.status === status) return;
    move(task.id, status);
  }

  function TaskCard({ task }: { task: Task }) {
    const colIdx = COLUMNS.findIndex((c) => c.status === task.status);
    return (
      <div
        key={task.id}
        className="v2-card"
        draggable
        onDragStart={(e) => {
          setDragTaskId(task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setDragTaskId(null)}
        style={{
          padding: "var(--v2-space-3)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}`,
          cursor: "grab",
          opacity: dragTaskId === task.id ? 0.5 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{task.title}</span>
          {blockedTaskIds.has(task.id) && <Badge tone="danger">Blocked</Badge>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              color: PRIORITY_COLOR[task.priority],
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)" }}>
            {groupBy === "service" ? "" : serviceName(task.serviceId)}
            {groupBy !== "service" && (groupBy === "assignee" ? "" : task.assigneeName ? ` · ${task.assigneeName}` : "")}
          </span>
        </div>
        {colIdx >= 0 && colIdx < COLUMNS.length - 1 && (
          <button
            type="button"
            onClick={() => move(task.id, COLUMNS[colIdx + 1].status)}
            disabled={movingTaskId === task.id}
            className={`v2-btn v2-btn-secondary ${movingTaskId === task.id ? "v2-btn-busy" : ""}`}
            style={{ padding: "4px 10px", fontSize: "0.7rem", alignSelf: "flex-start" }}
          >
            {movingTaskId === task.id && <Spinner size={11} />}
            {movingTaskId === task.id ? "Moving…" : `Move to ${COLUMNS[colIdx + 1].label.toLowerCase()} →`}
          </button>
        )}
      </div>
    );
  }

  function ColumnGrid({ tasksForGrid }: { tasksForGrid: Task[] }) {
    return (
      <div className="v2-kanban-grid">
        {COLUMNS.map((col) => {
          const colTasks = tasksForGrid.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(col.status);
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.status);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--v2-space-2)",
                minWidth: 0,
                borderRadius: "var(--v2-radius-sm)",
                background: dragOverStatus === col.status ? "var(--v2-accent-soft)" : "transparent",
                transition: "background-color var(--v2-transition)",
                padding: 4,
              }}
            >
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
                <p style={{ color: "var(--v2-text-faint)", fontSize: "0.8rem", padding: "0 var(--v2-space-2)" }}>
                  {dragOverStatus === col.status ? "Drop here" : "Nothing here."}
                </p>
              ) : (
                colTasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const key = groupBy === "service" ? serviceName(t.serviceId) : t.assigneeName.trim() || UNASSIGNED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy, serviceName]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: "var(--v2-space-3)", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--v2-text-muted)" }}>
          Group by
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="v2-input"
            style={{ width: "auto", padding: "4px 8px", fontSize: "0.78rem" }}
          >
            <option value="none">None</option>
            <option value="service">Service</option>
            <option value="assignee">Assignee</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--v2-text-muted)" }}>
          Assignee
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="v2-input"
            style={{ width: "auto", padding: "4px 8px", fontSize: "0.78rem" }}
          >
            <option value="">All</option>
            {assigneeOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "var(--v2-text-faint)" }}>
          Priority:
          {PRIORITY_ORDER.map((p) => (
            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: PRIORITY_COLOR[p], display: "inline-block" }} />
              {PRIORITY_LABEL[p]}
            </span>
          ))}
        </span>
      </div>

      {groups ? (
        groups.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>No tasks match this filter.</p>
        ) : (
          groups.map(([label, groupTasks]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--v2-text-faint)",
                  borderBottom: "1px solid var(--v2-border)",
                  paddingBottom: 4,
                }}
              >
                {label} <span style={{ fontWeight: 500, textTransform: "none" }}>({groupTasks.length})</span>
              </div>
              <ColumnGrid tasksForGrid={groupTasks} />
            </div>
          ))
        )
      ) : (
        <ColumnGrid tasksForGrid={filtered} />
      )}
    </div>
  );
}
