"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { Prospect, ProspectStatus, ServiceOption } from "@/components/prospects/types";
import { checkPmpEligibility } from "@/lib/pmp-eligibility";
import { buildConversationBrief, BRIEF_CONSUMED_KEYS } from "@/lib/conversation-brief";

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
  // Phase 3 — promoting also creates a follow-up Task (see
  // lib/db-prospects.ts's promoteProspectToLead). Tasks has no leadId
  // to look this back up later, so — same reasoning as LeadItem.tsx's
  // wonCustomerId — this is surfaced once, right after promotion, from
  // local state only.
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

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
        if (body.taskId) setCreatedTaskId(body.taskId);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't promote");
      }
    } finally {
      setPendingAction(null);
    }
  }

  // Phase 3 fix: excludes any key Conversation Brief already shows
  // above (see lib/conversation-brief.ts's BRIEF_CONSUMED_KEYS) — a
  // discovery-path prospect's answers were otherwise rendering twice,
  // once in the Brief panel and again here in raw key:value form.
  const answerEntries = Object.entries(prospect.assessmentAnswers || {}).filter(
    ([k, v]) => v && !BRIEF_CONSUMED_KEYS.has(k)
  );
  // Phase 2 — PMP eligibility, facts only. Same detection and
  // computation as LeadItem.tsx (see lib/pmp-eligibility.ts) — a
  // Prospect who answered the PMP eligibility questions gets the same
  // facts panel here, before promotion, not just after.
  const pmpFacts = prospect.assessmentAnswers && "educationPathway" in prospect.assessmentAnswers ? checkPmpEligibility(prospect.assessmentAnswers) : null;
  // Phase 3 — Conversation Brief. Built only from what was actually
  // captured (see lib/conversation-brief.ts) — never rendered when
  // nothing was captured (hasContent false), same "no empty panel"
  // discipline as the Assessment/PMP-facts panels below it.
  const brief = buildConversationBrief(prospect.assessmentAnswers);

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

      {brief.hasContent && (
        <div
          style={{
            margin: "var(--v2-space-2) 0 0",
            padding: "var(--v2-space-3)",
            background: "var(--v2-surface-sunken)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius, 8px)",
          }}
        >
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--v2-text-faint)", marginBottom: 6 }}>
            Conversation Brief
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Why they came: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{brief.whyTheyCame ?? "Not yet established"}</span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>What they told us: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{brief.mainChallenge ?? "Not yet established"}</span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>What they've tried: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{brief.whatTried ?? "Not yet established"}</span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Who this is for: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{brief.who ?? "Not yet established"}</span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Timing: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{brief.timing ?? "Not yet established"}</span>
            </div>
            {brief.categoryContext && (
              <div>
                <span style={{ color: "var(--v2-text-muted)" }}>Also noted: </span>
                <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{brief.categoryContext}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {pmpFacts ? (
        <div
          style={{
            margin: "var(--v2-space-2) 0 0",
            padding: "var(--v2-space-3)",
            background: "var(--v2-surface-sunken)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius, 8px)",
          }}
        >
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--v2-text-faint)", marginBottom: 6 }}>
            PMP Eligibility — facts
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Education pathway: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{pmpFacts.pathway ? pmpFacts.pathway.label : "Not specified"}</span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Reported experience: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>
                {pmpFacts.reportedMonths !== null ? `${pmpFacts.reportedMonths} months` : "Not specified"}
                {pmpFacts.pathway ? ` (pathway requires ${pmpFacts.pathway.requiredMonths})` : ""}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Within 10-year window: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{pmpFacts.recency ?? "Not specified"}</span>
            </div>
            <div>
              <span style={{ color: "var(--v2-text-muted)" }}>Training: </span>
              <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{pmpFacts.training ?? "Not specified"}</span>
            </div>
          </div>
          <p style={{ fontSize: "0.8rem", fontWeight: 500, margin: "6px 0 0" }}>{pmpFacts.statement}</p>
        </div>
      ) : (
        answerEntries.length > 0 && (
          <div style={{ margin: "var(--v2-space-2) 0 0", fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>
            {answerEntries.map(([key, value]) => (
              <div key={key}>
                <strong style={{ color: "var(--v2-text)" }}>{key}:</strong> {String(value)}
              </div>
            ))}
          </div>
        )
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

      {createdTaskId && (
        <p style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", margin: "8px 0 0" }}>
          → Follow-up task created — see{" "}
          <Link href="/tasks" style={{ color: "var(--v2-accent)" }}>
            Tasks
          </Link>
        </p>
      )}

      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: "8px 0 0" }}>{error}</p>}
    </Card>
  );
}
