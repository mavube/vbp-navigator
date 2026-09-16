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

export interface ServiceHealth {
  serviceId: string;
  status: HealthStatus;
  reasons: string[];
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
  const reasons: string[] = [];
  let status: HealthStatus = "healthy";

  function raise(level: HealthStatus, reason: string) {
    reasons.push(reason);
    if (level === "at_risk") status = "at_risk";
    else if (level === "attention" && status === "healthy") status = "attention";
  }

  if (!service.providerId) raise("at_risk", "No provider assigned");

  if (rollup.blockersHighImpact > 0) {
    raise(
      "at_risk",
      `${rollup.blockersHighImpact} high/critical blocker${rollup.blockersHighImpact === 1 ? "" : "s"} open`
    );
  }
  const lowerBlockers = rollup.blockersOpen - rollup.blockersHighImpact;
  if (lowerBlockers > 0) {
    raise("attention", `${lowerBlockers} blocker${lowerBlockers === 1 ? "" : "s"} open`);
  }

  if (rollup.tasksOverdue > 0) {
    raise("attention", `${rollup.tasksOverdue} task${rollup.tasksOverdue === 1 ? "" : "s"} overdue`);
  }

  if (rollup.budgetApprovedAmount > 0 && rollup.expensesTotal > rollup.budgetApprovedAmount) {
    raise("attention", "Expenses exceed approved budget");
  }

  const demand = rollup.tasksOpen + rollup.requestsOpen + rollup.leadsActive + rollup.classesActive;
  const people = rollup.capacityPeople;
  let capacity: CapacitySignal;
  if (demand === 0) {
    capacity = "idle";
  } else if (people === 0) {
    capacity = "overloaded";
    raise("at_risk", `${demand} active item${demand === 1 ? "" : "s"} with nobody assigned`);
  } else if (demand / people >= OVERLOAD_RATIO) {
    capacity = "overloaded";
    raise("attention", `High load: ${demand} active items across ${people} ${people === 1 ? "person" : "people"}`);
  } else if (demand / people >= STRETCH_RATIO) {
    capacity = "stretched";
  } else {
    capacity = "balanced";
  }

  return { serviceId: service.id, status, reasons, demand, people, capacity };
}
