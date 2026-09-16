"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import type { Lead, LeadStage } from "@/components/pipeline/types";

const STAGE_ORDER: LeadStage[] = ["new", "contacted", "assessed", "admitted"];
const STAGE_TONE: Record<LeadStage, "neutral" | "accent" | "success" | "danger"> = {
  new: "neutral",
  contacted: "accent",
  assessed: "accent",
  admitted: "success",
  lost: "danger",
};
const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  assessed: "Assessed",
  admitted: "Admitted",
  lost: "Lost",
};

export function LeadItem({
  lead,
  serviceName,
  onStageChange,
}: {
  lead: Lead;
  serviceName: string;
  onStageChange: (stage: LeadStage) => void;
}) {
  const [error, setError] = useState("");
  const [pendingStage, setPendingStage] = useState<LeadStage | null>(null);

  async function setStage(stage: LeadStage) {
    setError("");
    setPendingStage(stage);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        onStageChange(stage);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't update stage");
      }
    } finally {
      setPendingStage(null);
    }
  }

  const nextStage = lead.stage === "lost" ? null : STAGE_ORDER[STAGE_ORDER.indexOf(lead.stage) + 1];

  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{lead.contactName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
            {serviceName}
            {lead.contactEmail ? ` · ${lead.contactEmail}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
          <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
          {nextStage && (
            <button
              type="button"
              onClick={() => setStage(nextStage)}
              disabled={pendingStage !== null}
              className={`v2-btn v2-btn-secondary ${pendingStage === nextStage ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {pendingStage === nextStage && <Spinner size={11} />}
              {pendingStage === nextStage ? "Marking…" : `Mark ${STAGE_LABEL[nextStage].toLowerCase()}`}
            </button>
          )}
          {lead.stage !== "lost" && lead.stage !== "admitted" && (
            <button
              type="button"
              onClick={() => setStage("lost")}
              disabled={pendingStage !== null}
              className={`v2-btn v2-btn-secondary ${pendingStage === "lost" ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {pendingStage === "lost" && <Spinner size={11} />}
              {pendingStage === "lost" ? "Marking…" : "Mark lost"}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}

      {/* v3.0 Phase 4: admitting a lead also creates a Customer +
          Engagement (app/api/leads/[id]/route.ts) — a plain link to
          /customers rather than a deep link to the specific record,
          since that would need extra state plumbing this stays
          honest without. */}
      {lead.stage === "admitted" && (
        <p style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", margin: "8px 0 0" }}>
          → Customer record created — see <Link href="/customers" style={{ color: "var(--v2-accent)" }}>Customers</Link>
        </p>
      )}

      <CommentThread entityType="lead" entityId={lead.id} />
    </Card>
  );
}
