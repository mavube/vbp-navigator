"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { PRIORITY_BADGE_TONE, PRIORITY_LABEL, PRIORITY_ORDER } from "@/components/tasks/priority";
import type { Blocker, ClassEvent, ServiceOption, Task, TaskPriority, TaskStatus } from "@/components/tasks/types";

const STATUS_COLOR: Record<TaskStatus, string> = {
  open: "var(--v2-surface-sunken)",
  in_progress: "var(--v2-accent-soft)",
  done: "var(--v2-success-soft)",
};
const STATUS_TEXT: Record<TaskStatus, string> = {
  open: "var(--v2-text-muted)",
  in_progress: "var(--v2-accent)",
  done: "var(--v2-success)",
};
const STATUS_LABEL: Record<TaskStatus, string> = { open: "Open", in_progress: "In progress", done: "Done" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// v3.0 roadmap Phase 11 (Cluster D) — closes three gaps the audit named
// on this exact view: "no click-to-create-task-on-this-day, no
// click-into-task detail (tooltip only), not integrated with class
// sessions or blocker deadlines — those exist as separate,
// uncorrelated dates today." Class sessions become their own chip type
// (a class's own `scheduledDate`, same as a task lands on its own
// due/start date). Blockers don't carry their own date in the schema
// (supabase/migrations/0014) — there's nothing named "blocker
// deadline" to plot — so the real integration is surfacing a blocked
// task's open blockers (owner, impact, required action) right in the
// detail panel this phase adds, instead of that only living in the
// separate Blockers panel beneath the four work views. Documented here
// the same way prior phases have corrected an audit's exact wording
// against what the schema actually supports (see the Phase 10 build
// guide entry's Documents note for the precedent).
export function TaskCalendar({
  tasks,
  services,
  classes,
  blockers,
  serviceName,
  blockedTaskIds,
  onCreateTask,
  onStatusChange,
  onPriorityChange,
}: {
  tasks: Task[];
  services: ServiceOption[];
  classes: ClassEvent[];
  blockers: Blocker[];
  serviceName: (serviceId: string) => string;
  blockedTaskIds: Set<string>;
  onCreateTask?: (input: { serviceId: string; title: string; dueDate: string }) => Promise<void>;
  onStatusChange?: (taskId: string, status: TaskStatus) => Promise<void>;
  onPriorityChange?: (taskId: string, priority: TaskPriority) => Promise<void>;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [quickAddDay, setQuickAddDay] = useState<string | null>(null);
  const [quickAddServiceId, setQuickAddServiceId] = useState("");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");

  const byDayTasks = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const dateStr = t.dueDate ?? t.startDate;
      if (!dateStr) continue;
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(t);
    }
    return map;
  }, [tasks]);

  const byDayClasses = useMemo(() => {
    const map = new Map<string, ClassEvent[]>();
    for (const c of classes) {
      if (!c.scheduledDate) continue;
      if (!map.has(c.scheduledDate)) map.set(c.scheduledDate, []);
      map.get(c.scheduledDate)!.push(c);
    }
    return map;
  }, [classes]);

  const undated = tasks.filter((t) => !t.dueDate && !t.startDate);
  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null;
  const detailBlockers = detailTask ? blockers.filter((b) => b.status === "open" && b.taskId === detailTask.id) : [];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toKey(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  function openQuickAdd(dayKey: string) {
    if (!onCreateTask) return;
    setQuickAddDay(dayKey);
    setQuickAddServiceId("");
    setQuickAddTitle("");
    setQuickAddError("");
  }

  async function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAddDay || !onCreateTask) return;
    setQuickAddBusy(true);
    setQuickAddError("");
    try {
      await onCreateTask({ serviceId: quickAddServiceId, title: quickAddTitle.trim(), dueDate: quickAddDay });
      setQuickAddDay(null);
    } catch (err) {
      setQuickAddError(err instanceof Error ? err.message : "Couldn't create task");
    } finally {
      setQuickAddBusy(false);
    }
  }

  async function changeStatus(status: TaskStatus) {
    if (!detailTask || !onStatusChange) return;
    setDetailBusy(true);
    setDetailError("");
    try {
      await onStatusChange(detailTask.id, status);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setDetailBusy(false);
    }
  }

  async function changePriority(priority: TaskPriority) {
    if (!detailTask || !onPriorityChange) return;
    setDetailBusy(true);
    setDetailError("");
    try {
      await onPriorityChange(detailTask.id, priority);
    } catch {
      setDetailError("Couldn't update priority");
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <button type="button" className="v2-btn v2-btn-secondary" style={{ padding: "6px 10px", fontSize: "0.8rem" }} onClick={() => setCursor(new Date(year, month - 1, 1))}>
          ← Prev
        </button>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button type="button" className="v2-btn v2-btn-secondary" style={{ padding: "6px 10px", fontSize: "0.8rem" }} onClick={() => setCursor(new Date(year, month + 1, 1))}>
          Next →
        </button>
      </div>

      {onCreateTask && (
        <p style={{ fontSize: "0.72rem", color: "var(--v2-text-faint)", margin: 0 }}>
          Click any day to add a task due that day. Click a task or class to see details.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 600, color: "var(--v2-text-faint)", padding: "2px 0" }}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 84 }} />;
          const key = toKey(d);
          const dayTasks = byDayTasks.get(key) ?? [];
          const dayClasses = byDayClasses.get(key) ?? [];
          const isToday = key === todayKey;
          const totalEvents = dayTasks.length + dayClasses.length;
          return (
            <div
              key={i}
              role={onCreateTask ? "button" : undefined}
              tabIndex={onCreateTask ? 0 : undefined}
              onClick={() => openQuickAdd(key)}
              style={{
                minHeight: 84,
                border: "1px solid var(--v2-border)",
                borderRadius: "var(--v2-radius-sm)",
                padding: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                background: isToday ? "var(--v2-accent-soft)" : "var(--v2-surface)",
                cursor: onCreateTask ? "pointer" : "default",
              }}
            >
              <span style={{ fontSize: "0.7rem", fontWeight: isToday ? 700 : 500, color: isToday ? "var(--v2-accent)" : "var(--v2-text-faint)" }}>
                {d.getDate()}
              </span>
              {dayClasses.slice(0, 2).map((c) => (
                <span
                  key={`c-${c.id}`}
                  title={`Class: ${c.title} — ${serviceName(c.serviceId)}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: "0.65rem",
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: "var(--v2-warning-soft)",
                    color: "var(--v2-warning)",
                    border: "1px dashed currentColor",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  🎓 {c.title}
                </span>
              ))}
              {dayTasks.slice(0, totalEvents > 5 ? 2 : 3).map((t) => (
                <span
                  key={t.id}
                  title={`${t.title} — ${serviceName(t.serviceId)}${blockedTaskIds.has(t.id) ? " (blocked)" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailTaskId(t.id);
                    setDetailError("");
                  }}
                  style={{
                    fontSize: "0.65rem",
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: STATUS_COLOR[t.status],
                    color: STATUS_TEXT[t.status],
                    border: blockedTaskIds.has(t.id) ? "1px solid var(--v2-danger)" : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {blockedTaskIds.has(t.id) ? "⛔ " : ""}
                  {t.title}
                </span>
              ))}
              {totalEvents > 5 && (
                <span style={{ fontSize: "0.65rem", color: "var(--v2-text-faint)" }}>+{totalEvents - 4} more</span>
              )}
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)", margin: 0 }}>
          {undated.length} task{undated.length === 1 ? "" : "s"} with no date set, not shown above: {undated.map((t) => t.title).join(", ")}
        </p>
      )}

      {quickAddDay && (
        <div className="v2-modal-backdrop" onClick={() => setQuickAddDay(null)}>
          <div className="v2-modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>Add a task due {fmtDate(quickAddDay)}</h3>
            <form onSubmit={submitQuickAdd} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
              <select
                value={quickAddServiceId}
                onChange={(e) => setQuickAddServiceId(e.target.value)}
                required
                className="v2-input"
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
              <input
                type="text"
                placeholder="Task title"
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                required
                className="v2-input"
              />
              {quickAddError && <p style={{ color: "var(--v2-danger)", margin: 0, fontSize: "0.8rem" }}>{quickAddError}</p>}
              <div style={{ display: "flex", gap: "var(--v2-space-2)", justifyContent: "flex-end" }}>
                <button type="button" className="v2-btn v2-btn-secondary" onClick={() => setQuickAddDay(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddBusy || !quickAddServiceId || !quickAddTitle.trim()}
                  className={`v2-btn v2-btn-primary ${quickAddBusy ? "v2-btn-busy" : ""}`}
                >
                  {quickAddBusy && <Spinner />}
                  {quickAddBusy ? "Adding…" : "Add task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailTask && (
        <div className="v2-modal-backdrop" onClick={() => setDetailTaskId(null)}>
          <div className="v2-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{detailTask.title}</h3>
              <Badge tone={PRIORITY_BADGE_TONE[detailTask.priority]}>{PRIORITY_LABEL[detailTask.priority]}</Badge>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)", margin: "4px 0 0" }}>
              {serviceName(detailTask.serviceId)}
              {detailTask.assigneeName ? ` · ${detailTask.assigneeName}` : ""}
              {detailTask.startDate ? ` · starts ${detailTask.startDate}` : ""}
              {detailTask.dueDate ? ` · due ${detailTask.dueDate}` : ""}
            </p>

            <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", marginTop: "var(--v2-space-3)" }}>
              <Badge tone={detailTask.status === "done" ? "success" : detailTask.status === "in_progress" ? "accent" : "neutral"}>
                {STATUS_LABEL[detailTask.status]}
              </Badge>
              {onStatusChange &&
                (["open", "in_progress", "done"] as TaskStatus[])
                  .filter((s) => s !== detailTask.status)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={detailBusy}
                      onClick={() => changeStatus(s)}
                      className="v2-btn v2-btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      Mark {STATUS_LABEL[s].toLowerCase()}
                    </button>
                  ))}
              {onPriorityChange && (
                <select
                  value={detailTask.priority}
                  onChange={(e) => changePriority(e.target.value as TaskPriority)}
                  disabled={detailBusy}
                  className="v2-input"
                  style={{ padding: "3px 6px", fontSize: "0.75rem", width: "auto" }}
                  aria-label="Priority"
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {detailBlockers.length > 0 && (
              <div style={{ marginTop: "var(--v2-space-3)", padding: "var(--v2-space-3)", background: "var(--v2-danger-soft)", borderRadius: "var(--v2-radius-sm)" }}>
                <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 600, color: "var(--v2-danger)" }}>
                  Blocked — {detailBlockers.length} open blocker{detailBlockers.length === 1 ? "" : "s"}
                </p>
                {detailBlockers.map((b) => (
                  <div key={b.id} style={{ fontSize: "0.78rem", marginBottom: 4 }}>
                    <strong>{b.title}</strong> ({b.impact}) — owner: {b.ownerName || "unassigned"}
                    {b.requiredAction ? <> · needs: {b.requiredAction}</> : null}
                  </div>
                ))}
              </div>
            )}

            {detailError && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{detailError}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--v2-space-3)" }}>
              <Link href={`/tasks?service=${detailTask.serviceId}`} style={{ fontSize: "0.78rem", color: "var(--v2-accent)" }}>
                See all tasks for this service →
              </Link>
              <button type="button" className="v2-btn v2-btn-secondary" onClick={() => setDetailTaskId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
