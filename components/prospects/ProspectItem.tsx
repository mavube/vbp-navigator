"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Prospect, ProspectStatus, ServiceOption } from "@/components/prospects/types";

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
  onChange,
}: {
  prospect: Prospect;
  services: ServiceOption[];
  serviceName: string | null;
  onChange: (updated: Partial<Prospect>) => void;
}) {
  const [serviceId, setServiceId] = useState(prospect.serviceId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cvsServices = services.filter((s) => s.type === "cvs");

  async function setStatus(status: ProspectStatus) {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/prospects/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) {
      onChange({ status });
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't update");
    }
  }

  async function promote() {
    if (!serviceId) {
      setError("Choose which service this prospect is for first.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await fetch(`/api/prospects/${prospect.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      onChange({ status: "promoted", leadId: body.leadId, serviceId });
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't promote");
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
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone="neutral">{prospect.source === "assessment" ? "Assessment" : "Application"}</Badge>
          <Badge tone={STATUS_TONE[prospect.status]}>{STATUS_LABEL[prospect.status]}</Badge>
        </div>
      </div>

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
          <button type="button" onClick={promote} disabled={busy} className="v2-btn v2-btn-primary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Promote to lead
          </button>
          {prospect.status === "new" && (
            <button type="button" onClick={() => setStatus("reviewed")} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Mark reviewed
            </button>
          )}
          <button type="button" onClick={() => setStatus("declined")} disabled={busy} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
            Decline
          </button>
        </div>
      )}

      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </Card>
  );
}
