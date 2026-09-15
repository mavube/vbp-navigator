"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";
import { TaskItem } from "@/components/tasks/TaskItem";
import type { ServiceOption, Task } from "@/components/tasks/types";

export function TaskBoard() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      const [servicesRes, tasksRes] = await Promise.all([
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
      ]);
      if (!servicesRes.ok || !tasksRes.ok) throw new Error("failed to load");
      setServices(await servicesRes.json());
      setTasks(await tasksRes.json());
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

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card>
        <NewTaskForm
          services={services}
          onCreated={(task) => setTasks((prev) => [task, ...prev])}
        />
      </Card>

      {services.length === 0 && (
        <p style={{ color: "var(--v2-text-muted)" }}>
          No services in this org yet — see supabase/seed/vbp_services.sql to seed VBP's catalog.
        </p>
      )}

      {tasks.length === 0 ? (
        <p style={{ color: "var(--v2-text-muted)" }}>No tasks yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              serviceName={serviceName(task.serviceId)}
              onStatusChange={(status) =>
                setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
