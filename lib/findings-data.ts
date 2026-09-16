// Static definitions for the four seeded findings — the editable, synced
// part (status/note/updatedAt) lives in the database; this is the fixed
// title/body copy for each, carried over verbatim from the VBP Navigator
// Artifact.
//
// Findings 2 and 3 updated 2026-09-16 (v3.0 roadmap Phase 2) to match
// claude/vbp-internal-service-architecture.md's 2026-09-15 revision,
// which added the Compensation Earning Service as VBP's 5th enabling
// service — this file was the one place that update hadn't reached yet
// (flagged as a known gap in the build guide since that doc was written).

export type FindingSeverity = "watch" | "critical" | "elevated";

export interface FindingDef {
  id: string;
  title: string;
  body: string;
  severity: FindingSeverity;
}

export const FINDINGS: FindingDef[] = [
  {
    id: "finding-1",
    severity: "watch",
    title: 'The "IT" label hides a service in two different layers',
    body: 'Edwin provides Demand & Engagement — an enabling service, first touch in the chain — and separately Certification / Completion Fulfillment, a Customer Value Service at the very last step. They share nothing functionally and sit in different layers of the architecture. The department label "IT" explains neither.',
  },
  {
    id: "finding-2",
    severity: "critical",
    title: "Jennifer concentrates enabling services across nearly the whole chain — now spanning three services",
    body: "Jennifer provides Service Delivery Management, Financial & Commercial Administration, and — as of the Compensation Earning Service addition — runs the organization's compensation process too. Three enabling services, one of which (Compensation) touches every provider in the organization by definition. This is the same provider-concentration/single-point-of-failure risk as before, now structurally larger: it's not just that most CVS depend on Jennifer, it's that the org's ability to pay anyone now also does.",
  },
  {
    id: "finding-3",
    severity: "elevated",
    title: "Anne is a Customer Value Service provider and an enabling provider at once — now approving two enabling services",
    body: "Anne delivers two Customer Value Services — Master Class Delivery and Post-Training Certification Support — while also approving two enabling services: Financial & Commercial Administration, and now Compensation Earning Service. No backup is assigned to any of it. If she's unavailable, both CVS delivery and two separate approval chains lose their person at once.",
  },
  {
    id: "finding-4",
    severity: "elevated",
    title: "Candidate Admission has no owner, no backup, and barely a provider",
    body: "Candidate Admission should be its own Customer Value Service — provider, recipient, outcome, dependencies, owner, backup, all defined. Right now none of that is defined: Jennifer and Anne both touch it informally through lead follow-up, but nobody is accountable for confirming a candidate is actually enrolled.",
  },
];
