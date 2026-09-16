"use client";

import { useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/components/tasks/types";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// v3.0 Phase 6 — the Calendar work view. Each task lands on whichever
// single date is most relevant to plan around: its due date if it has
// one, otherwise its start date. A task with neither is listed
// separately below rather than silently dropped.
export function TaskCalendar({
  tasks,
  serviceName,
  blockedTaskIds,
}: {
  tasks: Task[];
  serviceName: (serviceId: string) => string;
  blockedTaskIds: Set<string>;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const dateStr = t.dueDate ?? t.startDate;
      if (!dateStr) continue;
      const key = dateStr; // already YYYY-MM-DD
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.dueDate && !t.startDate);

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 600, color: "var(--v2-text-faint)", padding: "2px 0" }}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: 76 }} />;
          const key = toKey(d);
          const dayTasks = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              style={{
                minHeight: 76,
                border: "1px solid var(--v2-border)",
                borderRadius: "var(--v2-radius-sm)",
                padding: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                background: isToday ? "var(--v2-accent-soft)" : "var(--v2-surface)",
              }}
            >
              <span style={{ fontSize: "0.7rem", fontWeight: isToday ? 700 : 500, color: isToday ? "var(--v2-accent)" : "var(--v2-text-faint)" }}>
                {d.getDate()}
              </span>
              {dayTasks.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  title={`${t.title} — ${serviceName(t.serviceId)}`}
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
                  }}
                >
                  {t.title}
                </span>
              ))}
              {dayTasks.length > 3 && <span style={{ fontSize: "0.65rem", color: "var(--v2-text-faint)" }}>+{dayTasks.length - 3} more</span>}
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)", margin: 0 }}>
          {undated.length} task{undated.length === 1 ? "" : "s"} with no date set, not shown above: {undated.map((t) => t.title).join(", ")}
        </p>
      )}
    </div>
  );
}
