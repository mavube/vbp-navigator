"use client";

import type { Task, TaskStatus } from "@/components/tasks/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_WINDOW_DAYS = 14;

const STATUS_COLOR: Record<TaskStatus, string> = {
  open: "var(--v2-text-faint)",
  in_progress: "var(--v2-accent)",
  done: "var(--v2-success)",
};

function parseDay(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function fmtShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// v3.0 Phase 6 — the Gantt work view. No charting/gantt library (this
// project deliberately avoids new dependencies where a plain component
// works — see the build guide's Phase 5 note on the same call for
// document rendering): a day-range is computed from every task's own
// start/due dates and each task becomes a positioned div bar, exactly
// the "computed live from real data" discipline the Service Graph
// (Phase 2) already established rather than a fixed layout.
export function TaskGantt({
  tasks,
  serviceName,
  blockedTaskIds,
}: {
  tasks: Task[];
  serviceName: (serviceId: string) => string;
  blockedTaskIds: Set<string>;
}) {
  const dated = tasks
    .filter((t) => t.startDate || t.dueDate)
    .map((t) => {
      const start = parseDay(t.startDate ?? t.dueDate!);
      const end = parseDay(t.dueDate ?? t.startDate!);
      return { task: t, start: start <= end ? start : end, end: start <= end ? end : start };
    });
  const undated = tasks.filter((t) => !t.startDate && !t.dueDate);

  if (dated.length === 0) {
    return (
      <p style={{ color: "var(--v2-text-muted)" }}>
        No tasks have a start or due date yet — add one from a task's "Set dates" control (or when creating a new task) to see it here.
      </p>
    );
  }

  let rangeStart = new Date(Math.min(...dated.map((d) => d.start.getTime())));
  let rangeEnd = new Date(Math.max(...dated.map((d) => d.end.getTime())));
  // Pad to a minimum legible window and a day of breathing room either side.
  rangeStart = new Date(rangeStart.getTime() - DAY_MS);
  rangeEnd = new Date(rangeEnd.getTime() + DAY_MS);
  const spanDays = Math.max(MIN_WINDOW_DAYS, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS) + 1);
  const totalMs = spanDays * DAY_MS;

  const today = new Date(new Date().toDateString());
  const todayPct = ((today.getTime() - rangeStart.getTime()) / totalMs) * 100;

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = new Date(rangeStart.getTime() + (totalMs / (tickCount - 1)) * i);
    return { pct: (i / (tickCount - 1)) * 100, label: fmtShort(t) };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      {/* A fixed-width label column plus percentage-positioned bars needs
          real horizontal room to stay legible — rather than fight that
          down to phone width, this scrolls horizontally within its own
          box (same pattern as a responsive data table) instead of ever
          pushing the page itself wider than the viewport. */}
      <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", height: 18 }}>
          <div style={{ width: 200, flexShrink: 0 }} />
          <div style={{ position: "relative", flex: 1, height: 18 }}>
            {ticks.map((t, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: `${t.pct}%`,
                  transform: i === tickCount - 1 ? "translateX(-100%)" : i === 0 ? "none" : "translateX(-50%)",
                  fontSize: "0.7rem",
                  color: "var(--v2-text-faint)",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {dated.map(({ task, start, end }) => {
          const leftPct = ((start.getTime() - rangeStart.getTime()) / totalMs) * 100;
          const widthPct = Math.max(((end.getTime() - start.getTime() + DAY_MS) / totalMs) * 100, 2);
          const blocked = blockedTaskIds.has(task.id);
          return (
            <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 0, minHeight: 30 }}>
              <div style={{ width: 200, flexShrink: 0, paddingRight: 10, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={task.title}>
                {task.title}
              </div>
              <div style={{ position: "relative", flex: 1, height: 22, background: "var(--v2-surface-sunken)", borderRadius: 4 }}>
                {todayPct >= 0 && todayPct <= 100 && (
                  <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: "var(--v2-danger)" }} />
                )}
                <div
                  title={`${serviceName(task.serviceId)} · ${fmtShort(start)} – ${fmtShort(end)}`}
                  style={{
                    position: "absolute",
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: 2,
                    bottom: 2,
                    borderRadius: 4,
                    background: STATUS_COLOR[task.status],
                    border: blocked ? "2px solid var(--v2-danger)" : "none",
                    opacity: task.status === "done" ? 0.6 : 1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <div style={{ display: "flex", gap: "var(--v2-space-4)", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR.open, marginRight: 4 }} />Open</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR.in_progress, marginRight: 4 }} />In progress</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR.done, marginRight: 4 }} />Done</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, border: "2px solid var(--v2-danger)", marginRight: 4 }} />Blocked</span>
        <span><span style={{ display: "inline-block", width: 1, height: 10, background: "var(--v2-danger)", marginRight: 4 }} />Today</span>
      </div>

      {undated.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)", margin: 0 }}>
          {undated.length} task{undated.length === 1 ? "" : "s"} with no dates set, not shown above: {undated.map((t) => t.title).join(", ")}
        </p>
      )}
    </div>
  );
}
