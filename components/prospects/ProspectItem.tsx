"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { Prospect, ProspectStatus, ServiceOption } from "@/components/prospects/types";

type ProspectAction = "reviewed" | "declined" | "promote";

const STATUS_TONE: Record<ProspectStatus, "neutral" | "accent" | "success" | "danger"> = {
  new: "neutral",
  reviewed: "accent",
  promoted: "success",
  declined: "danger",
};
const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  promoted: "Promoted",
  declined: "Declined",
};

export function ProspectItem({
  prospect,
  services,
  serviceName,
  productName,
  onChange,
}: {
  prospect: Prospect;
  services: ServiceOption[];
  serviceName: string | null;
  productName: string | null;
  onChange: (updated: Partial<Prospect>) => void;
}) {
  const [serviceId, setServiceId] = useState(prospect.serviceId ?? "");
  const [pendingAction, setPendingAction] = useState<ProspectAction | null>(null);
  const busy = pendingAction !== null;
  const [error, setError] = useState("");
  // v3.0 roadmap Phase 10 (Cluster C) — the non-blocking dedupe check
  // on promote (lib/db-prospects.ts's promoteProspectToLead) surfaces
  // here rather than in a dismissible toast, since staff need to still
  // see it after the promote button disappears (the prospect moves to
  // "Closed").
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const cvsServices = services.filter((s) => s.type === "cvs");

  async function setStatus(status: ProspectStatus, action: ProspectAction) {
    setError("");
    setPendingAction(action);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onChange({ status });
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't update");
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function promote() {
    if (!serviceId) {
      setError("Choose which service this prospect is for first.");
      return;
    }
    setError("");
    setPendingAction("promote");
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      if (res.ok) {
        const body = await res.json();
        onChange({ status: "promoted", leadId: body.leadId, serviceId });
        if (body.duplicateWarning) setDuplicateWarning(body.duplicateWarning);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't promote");
      }
    } finally {
      setPendingAction(null);
    }
  }

  const answerEntries = Object.entries(prospect.assessmentAnswers || {}).filter(([, v]) => v);

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{prospect.fullName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {[prospect.email, prospect.phone].filter(Boolean).join(" · ") || "No contact info given"}
            {serviceName ? ` · ${serviceName}` : ""}
          </div>
          {productName && (
            <div style={{ marginTop: 2 }}>
              <Badge tone="accent">{productName}</Badge>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone="neutral">
            {prospect.source === "assessment" ? "Assessment" : prospect.source === "manual" ? "Staff-logged" : "Application"}
          </Badge>
          <Badge tone={STATUS_TONE[prospect.status]}>{STATUS_LABEL[prospect.status]}</Badge>
        </div>
      </div>

      {duplicateWarning && (
        <p style={{ color: "var(--v2-warning, #B45309)", fontSize: "0.8rem", margin: "var(--v2-space-2) 0 0" }}>
          ⚠ {duplicateWarning}
        </p>
      )}

      {prospect.message && (
        <p style={{ fontSize: "0.85rem", color: "var(--v2-text-muted)", margin: "var(--v2-space-2) 0 0" }}>{prospect.message}</p>
      )}

      {answerEntries.length > 0 && (
        <div style={{ margin: "var(--v2-space-2) 0 0", fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>
          {answerEntries.map(([key, value]) => (
            <div key={key}>
              <strong style={{ color: "var(--v2-text)" }}>{key}:</strong> {String(value)}
            </div>
          ))}
        </div>
      )}

      {(prospect.status === "new" || prospect.status === "reviewed") && (
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap", marginTop: "var(--v2-space-3)" }}>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="v2-input" style={{ maxWidth: 220 }}>
            <option value="">Service…</option>
            {cvsServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={promote}
            disabled={busy}
            className={`v2-btn v2-btn-primary ${pendingAction === "promote" ? "v2-btn-busy" : ""}`}
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            {pendingAction === "promote" && <Spinner size={11} />}
            {pendingAction === "promote" ? "Promoting…" : "Promote to lead"}
          </button>
          {prospect.status === "new" && (
            <button
              type="button"
              onClick={() => setStatus("reviewed", "reviewed")}
              disabled={busy}
              className={`v2-btn v2-btn-secondary ${pendingAction === "reviewed" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {pendingAction === "reviewed" && <Spinner size={11} />}
              {pendingAction === "reviewed" ? "Marking…" : "Mark reviewed"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatus("declined", "declined")}
            disabled={busy}
            className={`v2-btn v2-btn-secondary ${pendingAction === "declined" ? "v2-btn-busy" : ""}`}
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            {pendingAction === "declined" && <Spinner size={11} />}
            {pendingAction === "declined" ? "Declining…" : "Decline"}
          </button>
        </div>
      )}

      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </Card>
  );
}
