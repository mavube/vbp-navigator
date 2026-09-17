// v3.0 roadmap Phase 7 — Service Health & Capacity Intelligence (§15-16,
// §18). A pure scoring function, deliberately with zero DB imports: it
// takes the numbers lib/rollups.ts already computed (one query per
// signal, grouped by service) and turns them into an explainable
// status + reason list. No new table, no black-box score — every
// reason is a plain sentence naming the exact fact that triggered it,
// so "why is this service at risk" is always answerable by reading
// `reasons`, not by reverse-engineering a formula.
//
// Kept dependency-free (only type-only imports) so it's safe to import
// from either a server API route or, later, straight into a client
// component without dragging in pg/sqlite driver code.

import type { ServiceRollup } from "@/lib/rollups";

export type HealthStatus = "healthy" | "attention" | "at_risk";
export type CapacitySignal = "idle" | "balanced" | "stretched" | "overloaded";

// v3.0 roadmap Phase 9 (Cluster B) — "Service Health's reasons[] are
// plain text — no drill-down link to the actual filtered list" was the
// audit's own wording. `reasons` becomes structured so a UI can render
// a real link where one exists (Tasks or Budget, both already support
// a `?service=` filter as of this phase — see components/tasks/
// TaskBoard.tsx and components/budget/BudgetWorkspace.tsx) and plain
// text where it doesn't (there's still no per-service detail page for
// "No provider assigned" to link to — a known, already-documented gap,
// not invented here). `href` is null rather than omitted so every
// caller has to consciously handle the no-link case instead of it
// silently being `undefined`.
export interface ServiceHealthReason {
  text: string;
  href: string | null;
}

export interface ServiceHealth {
  serviceId: string;
  status: HealthStatus;
  reasons: ServiceHealthReason[];
  demand: number;
  people: number;
  capacity: CapacitySignal;
}

// Capacity intelligence needs *some* threshold to turn raw counts into
// a signal — these are a first, clearly-labeled heuristic (open items
// per assigned person), not a tuned model. "Stretched" at 2 open items
// per person, "overloaded" at 4+, both plain constants named here so a
// future pass can recalibrate against real multi-person data instead
// of guessing from VBP's current ~5-person org.
const STRETCH_RATIO = 2;
const OVERLOAD_RATIO = 4;

export function computeServiceHealth(
  service: { id: string; providerId: string | null },
  rollup: ServiceRollup
): ServiceHealth {
  const reasons: ServiceHealthReason[] = [];
  let status: HealthStatus = "healthy";
  const tasksHref = `/tasks?service=${service.id}`;
  const tasksOverdueHref = `/tasks?service=${service.id}&focus=overdue`;
  const budgetHref = `/budget?service=${service.id}`;

  function raise(level: HealthStatus, text: string, href: string | null = null) {
    reasons.push({ text, href });
    if (level === "at_risk") status = "at_risk";
    else if (level === "attention" && status === "healthy") status = "attention";
  }

  // No per-service detail page exists yet to link this to (a known,
  // already-documented gap — see the v2.0 build guide's Phase 2 carried-
  // forward list) — left as plain text rather than a link to nowhere.
  if (!service.providerId) raise("at_risk", "No provider assigned");

  if (rollup.blockersHighImpact > 0) {
    raise(
      "at_risk",
      `${rollup.blockersHighImpact} high/critical blocker${rollup.blockersHighImpact === 1 ? "" : "s"} open`,
      tasksHref
    );
  }
  const lowerBlockers = rollup.blockersOpen - rollup.blockersHighImpact;
  if (lowerBlockers > 0) {
    raise("attention", `${lowerBlockers} blocker${lowerBlockers === 1 ? "" : "s"} open`, tasksHref);
  }

  if (rollup.tasksOverdue > 0) {
    raise("attention", `${rollup.tasksOverdue} task${rollup.tasksOverdue === 1 ? "" : "s"} overdue`, tasksOverdueHref);
  }

  if (rollup.budgetApprovedAmount > 0 && rollup.expensesTotal > rollup.budgetApprovedAmount) {
    raise("attention", "Expenses exceed approved budget", budgetHref);
  }

  const demand = rollup.tasksOpen + rollup.requestsOpen + rollup.leadsActive + rollup.classesActive;
  const people = rollup.capacityPeople;
  let capacity: CapacitySignal;
  if (demand === 0) {
    capacity = "idle";
  } else if (people === 0) {
    capacity = "overloaded";
    raise("at_risk", `${demand} active item${demand === 1 ? "" : "s"} with nobody assigned`, tasksHref);
  } else if (demand / people >= OVERLOAD_RATIO) {
    capacity = "overloaded";
    raise("attention", `High load: ${demand} active items across ${people} ${people === 1 ? "person" : "people"}`, tasksHref);
  } else if (demand / people >= STRETCH_RATIO) {
    capacity = "stretched";
  } else {
    capacity = "balanced";
  }

  return { serviceId: service.id, status, reasons, demand, people, capacity };
}
