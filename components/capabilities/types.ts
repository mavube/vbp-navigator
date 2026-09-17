export interface ServiceOption {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
  outcome: string;
  // v3.0 roadmap Phase 7 — health scoring needs to know whether a
  // provider is assigned; /api/services already returns this (Phase 2
  // catalogue extension), just not previously read by this page.
  providerId: string | null;
}

export interface ServiceRollup {
  serviceId: string;
  tasksOpen: number;
  tasksDone: number;
  tasksOverdue: number;
  requestsOpen: number;
  requestsResolved: number;
  leadsActive: number;
  leadsAdmitted: number;
  classesActive: number;
  classesCompleted: number;
  budgetPendingAmount: number;
  budgetApprovedAmount: number;
  expensesTotal: number;
  compensationFinalizedCount: number;
  compensationNetPayTotal: number;
  blockersOpen: number;
  blockersHighImpact: number;
  capacityPeople: number;
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
}

export interface PersonWorkload {
  name: string;
  activeTasks: number;
}

// v3.0 roadmap Phase 3 — matches lib/rollups.ts's FiscalYearTotals.
export interface FiscalYearTotals {
  fiscalYear: number;
  label: string;
  budgetApprovedTotal: number;
  expensesTotal: number;
  compensationNetPayTotal: number;
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
}

// v3.0 roadmap Phase 7 — matches lib/service-health.ts's ServiceHealth.
export type HealthStatus = "healthy" | "attention" | "at_risk";
export type CapacitySignal = "idle" | "balanced" | "stretched" | "overloaded";

// v3.0 roadmap Phase 9 — matches lib/service-health.ts's
// ServiceHealthReason: a reason with an optional drill-down link.
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
