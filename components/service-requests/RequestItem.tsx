"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import type { ServiceRequest, RequestStatus } from "@/components/service-requests/types";

const STATUS_ORDER: RequestStatus[] = ["open", "in_progress", "resolved", "closed"];
const STATUS_TONE: Record<RequestStatus, "neutral" | "accent" | "success"> = {
  open: "neutral",
  in_progress: "accent",
  resolved: "success",
  closed: "success",
};
const PRIORITY_TONE: Record<string, "neutral" | "accent" | "warning" | "danger"> = {
  low: "neutral",
  medium: "accent",
  high: "warning",
  urgent: "danger",
};

export function RequestItem({
  request,
  serviceName,
  onStatusChange,
}: {
  request: ServiceRequest;
  serviceName: string;
  onStatusChange: (status: RequestStatus) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // v3.0 roadmap Phase 9 (Cluster B) — "Service Requests are completely
  // isolated ... there's no way to spawn a Task from a request without
  // manually recreating it elsewhere" was the audit's own wording.
  // Checks once, on mount, whether a task has already been spawned from
  // this request (tasks.service_request_id — new in this phase, see
  // supabase/migrations/0016_phase9_workflow_wiring.sql) so the action
  // becomes "→ Task created" instead of offering to create a duplicate.
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [checkingTask, setCheckingTask] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  useEffect(() => {
    fetch(`/api/tasks?serviceRequestId=${request.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((tasks: Array<{ id: string }>) => setLinkedTaskId(tasks[0]?.id ?? null))
      .finally(() => setCheckingTask(false));
  }, [request.id]);

  async function createTask() {
    setCreatingTask(true);
    setTaskError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: request.serviceId,
          serviceRequestId: request.id,
          title: request.title,
          description: request.description,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create task");
      }
      const task = await res.json();
      setLinkedTaskId(task.id);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Couldn't create task");
    } finally {
      setCreatingTask(false);
    }
  }

  async function setStatus(status: RequestStatus) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/service-requests/${request.id}`, {
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
      setBusy(false);
    }
  }

  const nextStatus = request.status === "closed" ? null : STATUS_ORDER[STATUS_ORDER.indexOf(request.status) + 1];

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{request.title}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName} · {request.type === "incident" ? "Incident" : "Request"}
            {request.requesterName ? ` · ${request.requesterName}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone={PRIORITY_TONE[request.priority]}>{request.priority}</Badge>
          <Badge tone={STATUS_TONE[request.status]}>{request.status.replace("_", " ")}</Badge>
          {!checkingTask &&
            (linkedTaskId ? (
              <Link href={`/tasks?service=${request.serviceId}`} style={{ fontSize: "0.78rem", color: "var(--v2-accent)" }}>
                → Task created
              </Link>
            ) : (
              <button
                type="button"
                onClick={createTask}
                disabled={creatingTask || busy}
                className={`v2-btn v2-btn-secondary ${creatingTask ? "v2-btn-busy" : ""}`}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {creatingTask && <Spinner size={11} />}
                {creatingTask ? "Creating…" : "Create task"}
              </button>
            ))}
          {nextStatus && (
            <button
              type="button"
              onClick={() => setStatus(nextStatus)}
              disabled={busy}
              className={`v2-btn v2-btn-secondary ${busy ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy && <Spinner size={11} />}
              {busy ? "Marking…" : `Mark ${nextStatus.replace("_", " ")}`}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
      {taskError && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{taskError}</p>}

      <CommentThread entityType="service_request" entityId={request.id} />
    </Card>
  );
}
