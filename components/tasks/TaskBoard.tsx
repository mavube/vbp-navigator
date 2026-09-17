"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";
import { TaskItem } from "@/components/tasks/TaskItem";
import { TaskKanban } from "@/components/tasks/TaskKanban";
import { TaskGantt } from "@/components/tasks/TaskGantt";
import { TaskCalendar } from "@/components/tasks/TaskCalendar";
import { BlockersPanel } from "@/components/tasks/BlockersPanel";
import type { Blocker, ClassEvent, ServiceOption, Task, TaskPriority, TaskStatus } from "@/components/tasks/types";

type ViewMode = "list" | "kanban" | "gantt" | "calendar";
const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "list", label: "List" },
  { key: "kanban", label: "Kanban" },
  { key: "gantt", label: "Gantt" },
  { key: "calendar", label: "Calendar" },
];

// v3.0 Phase 6 — Work Views + Blocker Intelligence. Same data (tasks,
// services), four ways to look at it (List/Kanban/Gantt/Calendar) plus
// a Blockers section beneath — Blocker Intelligence isn't a separate
// page, it's part of the same work surface, since a blocker is always
// about work already tracked here.
//
// v3.0 Phase 9 (Cluster B) added `?service=<id>` and
// `&focus=overdue`/`&focus=blocked` query params — the drill-down
// destination for Service Health's reasons (lib/service-health.ts) and
// the Dashboard's at-risk list, neither of which previously had
// anywhere to send someone besides "go look at Tasks yourself."
export function TaskBoard() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unblockedNote, setUnblockedNote] = useState("");

  const searchParams = useSearchParams();
  const filterServiceId = searchParams.get("service") || "";
  const focus = searchParams.get("focus") || "";

  async function loadAll() {
    try {
      const [servicesRes, tasksRes, blockersRes, classesRes] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/blockers", { cache: "no-store" }),
        fetch("/api/classes", { cache: "no-store" }),
      ]);
      if (!servicesRes.ok || !tasksRes.ok || !blockersRes.ok || !classesRes.ok) throw new Error("failed to load");
      setServices(await servicesRes.json());
      setTasks(await tasksRes.json());
      setBlockers(await blockersRes.json());
      setClasses(await classesRes.json());
      setError("");
    } catch {
      setError("Couldn't load tasks — try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function serviceName(serviceId: string) {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }

  // v3.0 roadmap Phase 9 (Cluster B) shipped dependency enforcement on
  // this same PATCH and explicitly carried forward, as a known gap, that
  // Kanban's drag/button status change swallowed the rejection silently
  // (no inline error the way the List view's TaskItem already has) —
  // "worth closing alongside Cluster D" per that phase's build guide
  // entry. Now that Phase 11 (Cluster D) is touching Kanban anyway, this
  // throws the server's real message instead of failing silently, so
  // TaskKanban can show it the same way TaskItem/TaskCalendar do.
  async function patchStatus(taskId: string, status: TaskStatus) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    } else {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Couldn't update status");
    }
  }

  // Gantt drag-to-reschedule (Phase 11, Cluster D).
  async function patchDates(taskId: string, dates: { startDate: string | null; dueDate: string | null }) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dates),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...dates } : t)));
    } else {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Couldn't reschedule task");
    }
  }

  async function patchPriority(taskId: string, priority: TaskPriority) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, priority } : t)));
    } else {
      throw new Error("Couldn't update priority");
    }
  }

  // Calendar click-to-create-on-this-day (Phase 11, Cluster D) — same
  // POST /api/tasks NewTaskForm already uses, just with a due date
  // pre-filled from the day that was clicked instead of typed in.
  async function quickCreateTask(input: { serviceId: string; title: string; dueDate: string }) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Couldn't create task");
    }
    const task: Task = await res.json();
    setTasks((prev) => [task, ...prev]);
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  const blockedTaskIds = new Set(blockers.filter((b) => b.status === "open" && b.taskId).map((b) => b.taskId as string));
  const openBlockerCountByTask = new Map<string, number>();
  for (const b of blockers) {
    if (b.status === "open" && b.taskId) {
      openBlockerCountByTask.set(b.taskId, (openBlockerCountByTask.get(b.taskId) ?? 0) + 1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const filteredTasks = tasks
    .filter((t) => !filterServiceId || t.serviceId === filterServiceId)
    .filter((t) => {
      if (focus === "overdue") return t.status !== "done" && !!t.dueDate && t.dueDate < today;
      if (focus === "blocked") return blockedTaskIds.has(t.id);
      return true;
    });
  const filteredBlockers = filterServiceId ? blockers.filter((b) => b.serviceId === filterServiceId) : blockers;
  const filterLabel = filterServiceId ? services.find((s) => s.id === filterServiceId)?.name ?? "this service" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      {filterServiceId && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--v2-space-2)",
            padding: "var(--v2-space-3)",
            background: "var(--v2-accent-soft)",
            borderRadius: "var(--v2-radius-sm)",
            fontSize: "0.85rem",
          }}
        >
          <span>
            Showing {focus === "overdue" ? "overdue tasks" : focus === "blocked" ? "blocked tasks" : "tasks and blockers"} for{" "}
            <strong>{filterLabel}</strong>
          </span>
          <Link href="/tasks" style={{ color: "var(--v2-accent)" }}>
            Clear filter
          </Link>
        </div>
      )}

      {unblockedNote && <p style={{ color: "var(--v2-success)", margin: 0, fontSize: "0.85rem" }}>{unblockedNote}</p>}

      <Section title="Add a task" description="Every task belongs to a service — never a department or just a person. Start/due dates are optional but power the Gantt and Calendar views below.">
        <NewTaskForm services={services} tasks={tasks} onCreated={(task) => setTasks((prev) => [task, ...prev])} />
      </Section>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      )}

      <Section
        title="Work"
        description="Same tasks, four views."
        actions={
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className="v2-btn"
                style={{
                  background: view === v.key ? "var(--v2-accent-soft)" : "transparent",
                  color: view === v.key ? "var(--v2-accent)" : "var(--v2-text-muted)",
                  border: "none",
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        }
      >
        {filteredTasks.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>
            {tasks.length === 0 ? "No tasks yet." : "No tasks match this filter."}
          </p>
        ) : view === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                serviceName={serviceName(task.serviceId)}
                openBlockerCount={openBlockerCountByTask.get(task.id) ?? 0}
                allTasks={tasks}
                onStatusChange={(status) => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))}
                onDatesChange={(dates) => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...dates } : t)))}
                onPriorityChange={(priority) => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority } : t)))}
              />
            ))}
          </div>
        ) : view === "kanban" ? (
          <TaskKanban tasks={filteredTasks} serviceName={serviceName} blockedTaskIds={blockedTaskIds} onStatusChange={patchStatus} />
        ) : view === "gantt" ? (
          <TaskGantt tasks={filteredTasks} serviceName={serviceName} blockedTaskIds={blockedTaskIds} onDatesChange={patchDates} />
        ) : (
          <TaskCalendar
            tasks={filteredTasks}
            services={services}
            classes={filterServiceId ? classes.filter((c) => c.serviceId === filterServiceId) : classes}
            blockers={filteredBlockers}
            serviceName={serviceName}
            blockedTaskIds={blockedTaskIds}
            onCreateTask={quickCreateTask}
            onStatusChange={patchStatus}
            onPriorityChange={patchPriority}
          />
        )}
      </Section>

      <BlockersPanel
        services={services}
        tasks={tasks}
        blockers={filteredBlockers}
        serviceName={serviceName}
        onCreated={(b) => setBlockers((prev) => [b, ...prev])}
        onResolved={(result) => {
          setBlockers((prev) =>
            prev.map((b) => (b.id === result.id ? { ...b, status: "resolved", resolvedAt: new Date().toISOString() } : b))
          );
          if (result.unblockedTaskId && result.unblockedTaskStatus) {
            setTasks((prev) =>
              prev.map((t) => (t.id === result.unblockedTaskId ? { ...t, status: result.unblockedTaskStatus! } : t))
            );
            const unblocked = tasks.find((t) => t.id === result.unblockedTaskId);
            setUnblockedNote(
              `"${unblocked?.title ?? "That task"}" had no blockers left, so it was moved to In progress automatically.`
            );
          }
        }}
      />
    </div>
  );
}
