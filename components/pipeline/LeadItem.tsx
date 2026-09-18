"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import type { Lead, LeadStage } from "@/components/pipeline/types";

const STAGE_ORDER: LeadStage[] = ["new", "contacted", "qualified", "won"];
const STAGE_TONE: Record<LeadStage, "neutral" | "accent" | "success" | "danger"> = {
  new: "neutral",
  contacted: "accent",
  qualified: "accent",
  won: "success",
  lost: "danger",
};
const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

export function LeadItem({
  lead,
  serviceName,
  productName,
  onStageChange,
}: {
  lead: Lead;
  serviceName: string;
  productName: string | null;
  onStageChange: (stage: LeadStage) => void;
}) {
  const [error, setError] = useState("");
  const [pendingStage, setPendingStage] = useState<LeadStage | null>(null);
  const [wonCustomerId, setWonCustomerId] = useState<string | null>(null);

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
        const body: { customerId?: string | null } = await res.json().catch(() => ({}));
        if (body.customerId) setWonCustomerId(body.customerId);
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
            {lead.contactPhone ? ` · ${lead.contactPhone}` : ""}
          </div>
          {productName && (
            <div style={{ marginTop: 2 }}>
              <Badge tone="accent">{productName}</Badge>
            </div>
          )}
          {lead.notes && (
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>
              {lead.notes}
            </div>
          )}
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
          {lead.stage !== "lost" && lead.stage !== "won" && (
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

      {/* v3.0 Phase 4: winning a lead also creates a Customer +
          Engagement (app/api/leads/[id]/route.ts), which returns the
          new customerId. Deep-links to /customers?highlight=<id>
          (CustomersWorkspace scrolls to and highlights that card) when
          this component was the one that just marked the lead won —
          wonCustomerId only lives in this component's local state, so
          a lead that was already won before this page load falls back
          to the plain list link rather than a stale or guessed id. */}
      {lead.stage === "won" && (
        <p style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", margin: "8px 0 0" }}>
          → Customer record created — see{" "}
          <Link
            href={wonCustomerId ? `/customers?highlight=${wonCustomerId}` : "/customers"}
            style={{ color: "var(--v2-accent)" }}
          >
            Customers
          </Link>
        </p>
      )}

      <CommentThread entityType="lead" entityId={lead.id} />
    </Card>
  );
}
