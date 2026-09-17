"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/components/tasks/types";
import { PRIORITY_COLOR } from "@/components/tasks/priority";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_WINDOW_DAYS = 14;
const WEEK_ZOOM_PX_PER_DAY = 44;

const STATUS_COLOR: Record<TaskStatus, string> = {
  open: "var(--v2-text-faint)",
  in_progress: "var(--v2-accent)",
  done: "var(--v2-success)",
};

type Zoom = "month" | "week";

function parseDay(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function fmtShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Formats a Date back to a plain YYYY-MM-DD string using its *local*
// component getters (never toISOString, which is UTC and can land on
// the wrong day depending on the browser's timezone offset) — the same
// plain-string discipline lib/db-driver.ts's date type-parser fix
// exists to protect everywhere else in this app.
function fmtISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

interface Dragging {
  taskId: string;
  task: Task;
  startClientX: number;
  msPerPx: number;
  deltaDays: number;
}

// v3.0 roadmap Phase 11 (Cluster D) — closes three gaps the audit named
// on this exact view: "no swimlanes by service, no drag-to-reschedule,
// no week/month zoom." Still no charting/gantt library — same
// discipline as Phase 6's original build (see the file's original
// comment, kept below) — swimlanes are just a grouped render, zoom is
// two positioning modes (responsive percentage vs fixed pixels/day),
// and drag-to-reschedule is plain pointer-event math, not a plugin.
//
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
  onDatesChange,
}: {
  tasks: Task[];
  serviceName: (serviceId: string) => string;
  blockedTaskIds: Set<string>;
  // Optional — a caller that doesn't want drag-to-reschedule (or can't
  // persist it) simply omits this and bars render but don't drag.
  onDatesChange?: (taskId: string, dates: { startDate: string | null; dueDate: string | null }) => Promise<void>;
}) {
  const [zoom, setZoom] = useState<Zoom>("month");
  const [dragging, setDragging] = useState<Dragging | null>(null);
  // Event handlers below read the *current* drag state synchronously
  // (mousemove/mouseup fire outside React's render cycle) — a ref kept
  // in lockstep with the state avoids doing an async side effect (the
  // PATCH call) inside a setState updater function, which React may
  // invoke more than once.
  const draggingRef = useRef<Dragging | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const dated = useMemo(
    () =>
      tasks
        .filter((t) => t.startDate || t.dueDate)
        .map((t) => {
          const start = parseDay(t.startDate ?? t.dueDate!);
          const end = parseDay(t.dueDate ?? t.startDate!);
          return { task: t, start: start <= end ? start : end, end: start <= end ? end : start };
        }),
    [tasks]
  );
  const undated = tasks.filter((t) => !t.startDate && !t.dueDate);

  // Swimlanes by service — grouped in service-name order so the same
  // service always lands in the same visual position across reloads,
  // not insertion order.
  const swimlanes = useMemo(() => {
    const map = new Map<string, typeof dated>();
    for (const d of dated) {
      const name = serviceName(d.task.serviceId);
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dated, serviceName]);

  const range = useMemo(() => {
    if (dated.length === 0) return null;
    let rangeStart = new Date(Math.min(...dated.map((d) => d.start.getTime())));
    let rangeEnd = new Date(Math.max(...dated.map((d) => d.end.getTime())));
    rangeStart = new Date(rangeStart.getTime() - DAY_MS);
    rangeEnd = new Date(rangeEnd.getTime() + DAY_MS);
    const spanDays = Math.max(MIN_WINDOW_DAYS, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS) + 1);
    const totalMs = spanDays * DAY_MS;
    return { rangeStart, rangeEnd, spanDays, totalMs };
  }, [dated]);

  // Drag lifecycle — window-level listeners only while a drag is live,
  // torn down immediately after (mirrors the sidebar's own
  // mount/unmount discipline elsewhere in this app: no listener left
  // registered longer than it's needed).
  useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      const prev = draggingRef.current;
      if (!prev) return;
      const deltaPx = e.clientX - prev.startClientX;
      const deltaMs = deltaPx * prev.msPerPx;
      const deltaDays = Math.round(deltaMs / DAY_MS);
      const next = { ...prev, deltaDays };
      draggingRef.current = next;
      setDragging(next);
    }
    function onUp() {
      const prev = draggingRef.current;
      draggingRef.current = null;
      setDragging(null);
      if (prev && prev.deltaDays !== 0 && onDatesChange) {
        const { task, deltaDays } = prev;
        const newStartDate = task.startDate ? fmtISODate(addDays(parseDay(task.startDate), deltaDays)) : null;
        const newDueDate = task.dueDate ? fmtISODate(addDays(parseDay(task.dueDate), deltaDays)) : null;
        setSaving(task.id);
        setError("");
        onDatesChange(task.id, { startDate: newStartDate, dueDate: newDueDate })
          .catch(() => setError(`Couldn't reschedule "${task.title}" — try again.`))
          .finally(() => setSaving(null));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging !== null]);

  if (!range) {
    return (
      <p style={{ color: "var(--v2-text-muted)" }}>
        No tasks have a start or due date yet — add one from a task's "Set dates" control (or when creating a new task) to see it here.
      </p>
    );
  }

  const { rangeStart, spanDays, totalMs } = range;
  const today = new Date(new Date().toDateString());
  const todayPct = ((today.getTime() - rangeStart.getTime()) / totalMs) * 100;
  const timelineMinWidth = zoom === "week" ? spanDays * WEEK_ZOOM_PX_PER_DAY : 560;

  const tickCount = zoom === "week" ? spanDays : 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = zoom === "week" ? new Date(rangeStart.getTime() + i * DAY_MS) : new Date(rangeStart.getTime() + (totalMs / (tickCount - 1)) * i);
    const pct = zoom === "week" ? (i * DAY_MS) / totalMs * 100 : (i / (tickCount - 1)) * 100;
    return { pct, label: fmtShort(t) };
  });

  function startDrag(e: React.MouseEvent, task: Task, laneEl: HTMLDivElement) {
    if (!onDatesChange) return;
    e.preventDefault();
    const rect = laneEl.getBoundingClientRect();
    const next: Dragging = { taskId: task.id, task, startClientX: e.clientX, msPerPx: totalMs / rect.width, deltaDays: 0 };
    draggingRef.current = next;
    setDragging(next);
  }

  function Bar({ task, start, end }: { task: Task; start: Date; end: Date }) {
    const leftPct = ((start.getTime() - rangeStart.getTime()) / totalMs) * 100;
    const widthPct = Math.max(((end.getTime() - start.getTime() + DAY_MS) / totalMs) * 100, zoom === "week" ? 100 / spanDays : 2);
    const blocked = blockedTaskIds.has(task.id);
    const isDragging = dragging?.taskId === task.id;
    const dragOffsetPct = isDragging ? (dragging.deltaDays * DAY_MS / totalMs) * 100 : 0;
    const isSaving = saving === task.id;
    return (
      <div
        key={task.id}
        data-gantt-lane
        style={{ position: "relative", flex: 1, height: 22, background: "var(--v2-surface-sunken)", borderRadius: 4 }}
      >
        {todayPct >= 0 && todayPct <= 100 && (
          <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: "var(--v2-danger)" }} />
        )}
        <div
          onMouseDown={(e) => startDrag(e, task, e.currentTarget.parentElement as HTMLDivElement)}
          title={
            onDatesChange
              ? `${serviceName(task.serviceId)} · ${fmtShort(start)} – ${fmtShort(end)} · drag to reschedule`
              : `${serviceName(task.serviceId)} · ${fmtShort(start)} – ${fmtShort(end)}`
          }
          style={{
            position: "absolute",
            left: `${leftPct + dragOffsetPct}%`,
            width: `${widthPct}%`,
            top: 2,
            bottom: 2,
            borderRadius: 4,
            background: STATUS_COLOR[task.status],
            border: blocked ? "2px solid var(--v2-danger)" : `2px solid ${PRIORITY_COLOR[task.priority]}`,
            opacity: task.status === "done" ? 0.6 : isSaving ? 0.5 : 1,
            cursor: onDatesChange ? (isDragging ? "grabbing" : "grab") : "default",
            transition: isDragging ? "none" : "opacity var(--v2-transition)",
            boxShadow: isDragging ? "var(--v2-shadow-lg)" : "none",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {(["month", "week"] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className="v2-btn"
              style={{
                background: zoom === z ? "var(--v2-accent-soft)" : "transparent",
                color: zoom === z ? "var(--v2-accent)" : "var(--v2-text-muted)",
                border: "1px solid var(--v2-border)",
                padding: "5px 12px",
                fontSize: "0.75rem",
              }}
            >
              {z === "month" ? "Fit to width" : "Week zoom"}
            </button>
          ))}
        </div>
        {onDatesChange && (
          <span style={{ fontSize: "0.72rem", color: "var(--v2-text-faint)" }}>Drag a bar left or right to reschedule.</span>
        )}
      </div>

      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: 0 }}>{error}</p>}

      {/* A fixed-width label column plus percentage/pixel-positioned bars
          needs real horizontal room to stay legible — rather than fight
          that down to phone width, this scrolls horizontally within its
          own box (same pattern as a responsive data table) instead of
          ever pushing the page itself wider than the viewport. */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: timelineMinWidth }}>
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

          {swimlanes.map(([laneName, laneTasks]) => (
            <div key={laneName} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--v2-text-faint)",
                  borderTop: "1px solid var(--v2-border)",
                  paddingTop: 6,
                }}
              >
                {laneName} <span style={{ fontWeight: 500, textTransform: "none" }}>({laneTasks.length})</span>
              </div>
              {laneTasks.map(({ task, start, end }) => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 0, minHeight: 30 }}>
                  <div
                    style={{ width: 200, flexShrink: 0, paddingRight: 10, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                  <Bar task={task} start={start} end={end} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--v2-space-4)", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--v2-text-muted)" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR.open, marginRight: 4 }} />Open</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR.in_progress, marginRight: 4 }} />In progress</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STATUS_COLOR.done, marginRight: 4 }} />Done</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, border: "2px solid var(--v2-danger)", marginRight: 4 }} />Blocked</span>
        <span><span style={{ display: "inline-block", width: 1, height: 10, background: "var(--v2-danger)", marginRight: 4 }} />Today</span>
        <span>Bar outline color = priority (unless blocked)</span>
      </div>

      {undated.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)", margin: 0 }}>
          {undated.length} task{undated.length === 1 ? "" : "s"} with no dates set, not shown above: {undated.map((t) => t.title).join(", ")}
        </p>
      )}
    </div>
  );
}
