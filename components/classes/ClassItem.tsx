"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import type { Class, ClassStatus, SetupTask, SetupTaskStatus } from "@/components/classes/types";

const STATUS_ORDER: ClassStatus[] = ["scheduled", "in_progress", "completed"];
const STATUS_TONE: Record<ClassStatus, "neutral" | "accent" | "success" | "danger"> = {
  scheduled: "neutral",
  in_progress: "accent",
  completed: "success",
  cancelled: "danger",
};
const STATUS_LABEL: Record<ClassStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ClassItem({
  cls,
  serviceName,
  onStatusChange,
}: {
  cls: Class;
  serviceName: string;
  onStatusChange: (status: ClassStatus) => void;
}) {
  const [tasks, setTasks] = useState<SetupTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<ClassStatus | null>(null);

  // v3.0 roadmap Phase 9 (Cluster B) — the optional, staff-entered
  // invoice generated alongside marking a class completed. Off by
  // default: not every completed class bills a customer immediately
  // (or at all), so this never fires unless someone explicitly opts in
  // and enters a real amount — see app/api/classes/[id]/route.ts for
  // why a number is never invented here.
  const [wantInvoice, setWantInvoice] = useState(false);
  const [invoiceParty, setInvoiceParty] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceCreated, setInvoiceCreated] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks?classId=${cls.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SetupTask[]) => setTasks(data))
      .finally(() => setTasksLoading(false));
  }, [cls.id]);

  async function setClassStatus(status: ClassStatus) {
    setError("");
    setPendingStatus(status);
    try {
      const invoice =
        status === "completed" && wantInvoice && invoiceParty.trim() && invoiceAmount
          ? { party: invoiceParty.trim(), amount: Number(invoiceAmount), dueDate: invoiceDueDate || undefined }
          : undefined;
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(invoice ? { invoice } : {}) }),
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        if (result.invoice) setInvoiceCreated(true);
        onStatusChange(status);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't update status");
      }
    } finally {
      setPendingStatus(null);
    }
  }

  async function setTaskStatus(taskId: string, status: SetupTaskStatus) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    }
  }

  const nextStatus = cls.status === "cancelled" || cls.status === "completed" ? null : STATUS_ORDER[STATUS_ORDER.indexOf(cls.status) + 1];
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const openTaskCount = tasks.length - doneCount;
  // v3.0 roadmap Phase 9 — the client-side mirror of the same gate the
  // server enforces (app/api/classes/[id]/route.ts): completing a class
  // with its setup checklist still open is disabled here, not just
  // rejected after the click, so the reason is visible up front.
  const completionGated = nextStatus === "completed" && !tasksLoading && openTaskCount > 0;

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{cls.title}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName}
            {cls.scheduledDate ? ` · ${cls.scheduledDate}` : ""}
            {cls.instructorName ? ` · ${cls.instructorName}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={STATUS_TONE[cls.status]}>{STATUS_LABEL[cls.status]}</Badge>
          {nextStatus && (
            <button
              type="button"
              onClick={() => setClassStatus(nextStatus)}
              disabled={pendingStatus !== null || completionGated}
              title={completionGated ? `Finish the setup checklist first — ${openTaskCount} task(s) still open` : undefined}
              className={`v2-btn v2-btn-secondary ${pendingStatus === nextStatus ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {pendingStatus === nextStatus && <Spinner size={11} />}
              {pendingStatus === nextStatus ? "Marking…" : `Mark ${STATUS_LABEL[nextStatus].toLowerCase()}`}
            </button>
          )}
          {cls.status !== "cancelled" && cls.status !== "completed" && (
            <button
              type="button"
              onClick={() => setClassStatus("cancelled")}
              disabled={pendingStatus !== null}
              className={`v2-btn v2-btn-secondary ${pendingStatus === "cancelled" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {pendingStatus === "cancelled" && <Spinner size={11} />}
              {pendingStatus === "cancelled" ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
      {completionGated && (
        <p style={{ color: "var(--v2-text-muted)", fontSize: "0.8rem", margin: "8px 0 0" }}>
          Finish the setup checklist below before marking this class completed — {openTaskCount} task
          {openTaskCount === 1 ? "" : "s"} still open.
        </p>
      )}

      {nextStatus === "completed" && !completionGated && !invoiceCreated && (
        <div
          style={{
            marginTop: "var(--v2-space-3)",
            padding: "var(--v2-space-3)",
            background: "var(--v2-surface-sunken)",
            borderRadius: "var(--v2-radius-sm)",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" checked={wantInvoice} onChange={(e) => setWantInvoice(e.target.checked)} />
            Generate an outgoing invoice for this class when marked completed
          </label>
          {wantInvoice && (
            <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", marginTop: "var(--v2-space-2)" }}>
              <Input placeholder="Customer" value={invoiceParty} onChange={(e) => setInvoiceParty(e.target.value)} style={{ flex: "1 1 180px" }} />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                style={{ maxWidth: 140 }}
              />
              <Input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} title="Due date (optional)" style={{ maxWidth: 160 }} />
            </div>
          )}
        </div>
      )}
      {invoiceCreated && (
        <p style={{ color: "var(--v2-success)", fontSize: "0.8rem", margin: "8px 0 0" }}>
          Invoice created — see it under Budget → Invoices.
        </p>
      )}

      <div style={{ marginTop: "var(--v2-space-3)", borderTop: "1px solid var(--v2-border)", paddingTop: "var(--v2-space-3)" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", marginBottom: "var(--v2-space-2)" }}>
          Setup checklist {tasksLoading ? "" : `(${doneCount}/${tasks.length})`}
        </div>
        {tasksLoading ? (
          <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", margin: 0 }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {tasks.map((task) => (
              <label
                key={task.id}
                style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  onChange={(e) => setTaskStatus(task.id, e.target.checked ? "done" : "open")}
                />
                <span style={{ textDecoration: task.status === "done" ? "line-through" : "none", color: task.status === "done" ? "var(--v2-text-faint)" : "inherit" }}>
                  {task.title}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <CommentThread entityType="class" entityId={cls.id} />
    </Card>
  );
}
