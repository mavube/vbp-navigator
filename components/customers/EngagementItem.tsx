"use client";

// Phase E (Customer Workspace rebuild) — closes a real gap: an
// Engagement's status has been frozen at 'active' since Phase 4
// (convertLead sets it and nothing ever changed it again — see
// app/api/engagements/[id]/route.ts's PATCH, added in this phase, for
// the full story). This is the first place in the app an Engagement's
// status and outcome can actually be updated.

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { Engagement, EngagementStatus } from "@/components/customers/types";

const STATUS_TONE: Record<EngagementStatus, "accent" | "success" | "neutral"> = {
  active: "accent",
  completed: "success",
  paused: "neutral",
};

export function EngagementItem({
  engagement,
  serviceName,
  productName,
  ownerName,
  onUpdated,
}: {
  engagement: Engagement;
  serviceName: string;
  productName: string | null;
  ownerName: string | null;
  onUpdated: (patch: Partial<Engagement>) => void;
}) {
  const [busy, setBusy] = useState<EngagementStatus | null>(null);
  const [error, setError] = useState("");
  const [noteDraft, setNoteDraft] = useState(engagement.outcomeNote);
  const [editingNote, setEditingNote] = useState(false);

  async function setStatus(status: EngagementStatus, outcomeNote?: string) {
    setBusy(status);
    setError("");
    try {
      const res = await fetch(`/api/engagements/${engagement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(outcomeNote !== undefined ? { outcomeNote } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't update this engagement");
      }
      onUpdated({ status, ...(outcomeNote !== undefined ? { outcomeNote } : {}) });
      setEditingNote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this engagement");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "var(--v2-space-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{productName ?? serviceName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {productName ? `${serviceName} · ` : ""}
            since {new Date(engagement.startedAt).toLocaleDateString()}
            {ownerName ? ` · owner: ${ownerName}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={STATUS_TONE[engagement.status]}>{engagement.status}</Badge>
          {engagement.status !== "completed" && (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              disabled={busy !== null}
              className={`v2-btn v2-btn-secondary ${busy === "completed" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy === "completed" && <Spinner size={11} />}
              Mark completed
            </button>
          )}
          {engagement.status === "active" && (
            <button
              type="button"
              onClick={() => setStatus("paused")}
              disabled={busy !== null}
              className={`v2-btn v2-btn-secondary ${busy === "paused" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy === "paused" && <Spinner size={11} />}
              Pause
            </button>
          )}
          {engagement.status === "paused" && (
            <button
              type="button"
              onClick={() => setStatus("active")}
              disabled={busy !== null}
              className={`v2-btn v2-btn-secondary ${busy === "active" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy === "active" && <Spinner size={11} />}
              Reactivate
            </button>
          )}
        </div>
      </div>

      {editingNote && (
        <div style={{ marginTop: "var(--v2-space-2)", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <textarea
            className="v2-input"
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Outcome (optional) — what did this engagement actually deliver?"
          />
          <div style={{ display: "flex", gap: "var(--v2-space-2)" }}>
            <button
              type="button"
              onClick={() => setStatus("completed", noteDraft)}
              disabled={busy !== null}
              className={`v2-btn v2-btn-primary ${busy === "completed" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy === "completed" && <Spinner size={11} />}
              {busy === "completed" ? "Saving…" : "Confirm completed"}
            </button>
            <button
              type="button"
              onClick={() => { setEditingNote(false); setNoteDraft(engagement.outcomeNote); }}
              disabled={busy !== null}
              className="v2-btn v2-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editingNote && engagement.outcomeNote && (
        <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", marginTop: "var(--v2-space-2)", whiteSpace: "pre-wrap" }}>
          {engagement.outcomeNote}
        </p>
      )}
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
