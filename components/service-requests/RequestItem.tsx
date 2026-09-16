"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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

  async function setStatus(status: RequestStatus) {
    setError("");
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
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={PRIORITY_TONE[request.priority]}>{request.priority}</Badge>
          <Badge tone={STATUS_TONE[request.status]}>{request.status.replace("_", " ")}</Badge>
          {nextStatus && (
            <button type="button" onClick={() => setStatus(nextStatus)} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Mark {nextStatus.replace("_", " ")}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}

      <CommentThread entityType="service_request" entityId={request.id} />
    </Card>
  );
}
