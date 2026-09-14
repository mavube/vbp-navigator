// Static definitions for the four seeded findings — the editable, synced
// part (status/note/updatedAt) lives in the database; this is the fixed
// title/body copy for each, carried over verbatim from the VBP Navigator
// Artifact.

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
    title: "Jennifer concentrates enabling services across nearly the whole chain",
    body: "Jennifer provides Service Delivery Management and Financial & Commercial Administration — two enabling services that most Customer Value Services in the chain depend on. That's provider concentration: a single point of failure sitting underneath the value chain, not a workload problem confined to one service.",
  },
  {
    id: "finding-3",
    severity: "elevated",
    title: "Anne is a Customer Value Service provider and an enabling provider at once",
    body: "Anne delivers two Customer Value Services — Master Class Delivery and Post-Training Certification Support — while also approving Financial & Commercial Administration, an enabling service. If she's unavailable, a CVS the client is paying for and an enabling function both lose their provider at once, and no backup is assigned to either.",
  },
  {
    id: "finding-4",
    severity: "elevated",
    title: "Candidate Admission has no owner, no backup, and barely a provider",
    body: "Candidate Admission should be its own Customer Value Service — provider, recipient, outcome, dependencies, owner, backup, all defined. Right now none of that is defined: Jennifer and Anne both touch it informally through lead follow-up, but nobody is accountable for confirming a candidate is actually enrolled.",
  },
];
