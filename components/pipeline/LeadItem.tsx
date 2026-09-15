"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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

  async function setStage(stage: LeadStage) {
    setError("");
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
              className="v2-btn v2-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Mark {STAGE_LABEL[nextStage].toLowerCase()}
            </button>
          )}
          {lead.stage !== "lost" && lead.stage !== "admitted" && (
            <button
              type="button"
              onClick={() => setStage("lost")}
              className="v2-btn v2-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Mark lost
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </Card>
  );
}
