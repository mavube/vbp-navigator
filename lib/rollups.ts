// The Phase 7 reporting layer — Capabilities/Workload + Outcomes
// metrics. Deliberately not its own table: every number here is a live
// COUNT/SUM over tables that already exist (tasks, leads, classes,
// service_requests, budget_requests, expenses, compensation_entries),
// grouped by service_id. That keeps the numbers always-accurate with
// nothing to go stale, and — same non-hardcoding discipline as
// Pipeline's no-auto-transition (Phase 3) and Classes' service-tagging
// (Phase 4) — it computes the *same* metrics for every service
// regardless of type, rather than special-casing "Master Class
// Delivery" or "Compensation Earning Service" by name, which would
// break for any tenant with a different catalog.
//
// "Workload" and "Outcomes" are two lenses on the same underlying
// counts: active/open items per service is a capacity signal
// (Workload); completed/finalized items and amounts per service is a
// throughput/value signal (Outcomes) — see ServiceRollup below, which
// carries both.

import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { listServices } from "@/lib/db-services";
import { ensureTasksSchema } from "@/lib/db-tasks";
import { ensureServiceRequestsSchema } from "@/lib/db-service-requests";
import { ensureLeadsSchema } from "@/lib/db-leads";
import { ensureClassesSchema } from "@/lib/db-classes";
import { ensureBudgetSchema } from "@/lib/db-budget";
import { ensureExpensesSchema } from "@/lib/db-expenses";
import { ensureCompensationSchema } from "@/lib/db-compensation";

// On the local SQLite driver, each module creates its own table lazily —
// only once one of that module's own functions is first called. Rollups
// queries all seven tables directly (for cross-driver-portable grouped
// aggregation, see groupedQuery below), so a service with e.g. no leads
// yet would otherwise hit "no such table: leads". Forcing every table
// into existence up front fixes that; it's a no-op on Postgres, where
// the migrations already own the schema.
async function ensureAllSchemas(): Promise<void> {
  await Promise.all([
    ensureTasksSchema(),
    ensureServiceRequestsSchema(),
    ensureLeadsSchema(),
    ensureClassesSchema(),
    ensureBudgetSchema(),
    ensureExpensesSchema(),
    ensureCompensationSchema(),
  ]);
}

export interface ServiceRollup {
  serviceId: string;
  tasksOpen: number;
  tasksDone: number;
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
}

export interface PersonWorkload {
  name: string;
  activeTasks: number;
}

function emptyRollup(serviceId: string): ServiceRollup {
  return {
    serviceId,
    tasksOpen: 0,
    tasksDone: 0,
    requestsOpen: 0,
    requestsResolved: 0,
    leadsActive: 0,
    leadsAdmitted: 0,
    classesActive: 0,
    classesCompleted: 0,
    budgetPendingAmount: 0,
    budgetApprovedAmount: 0,
    expensesTotal: 0,
    compensationFinalizedCount: 0,
    compensationNetPayTotal: 0,
  };
}

// Runs one grouped aggregation query and returns rows keyed by
// service_id — same shape from either driver, so each metric below is
// just "run this query, merge these columns into the rollup map."
async function groupedQuery(orgId: string, sql: { pg: string; sqlite: string }): Promise<Record<string, unknown>[]> {
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(sql.pg, [orgId]);
    return res.rows;
  }
  return (await getSqliteDb()).prepare(sql.sqlite).all(orgId) as Record<string, unknown>[];
}

export async function getServiceRollups(orgId: string): Promise<ServiceRollup[]> {
  await ensureAllSchemas();
  const services = await listServices(orgId);
  const rollups = new Map<string, ServiceRollup>(services.map((s) => [s.id, emptyRollup(s.id)]));
  const get = (serviceId: string) => rollups.get(serviceId) ?? rollups.set(serviceId, emptyRollup(serviceId)).get(serviceId)!;

  const tasks = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done FROM tasks WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done FROM tasks WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of tasks) {
    const r = get(row.service_id as string);
    r.tasksOpen = Number(row.open) || 0;
    r.tasksDone = Number(row.done) || 0;
  }

  const requests = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved FROM service_requests WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved FROM service_requests WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of requests) {
    const r = get(row.service_id as string);
    r.requestsOpen = Number(row.open) || 0;
    r.requestsResolved = Number(row.resolved) || 0;
  }

  const leads = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(CASE WHEN stage IN ('new','contacted','assessed') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN stage = 'admitted' THEN 1 ELSE 0 END) AS admitted FROM leads WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN stage IN ('new','contacted','assessed') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN stage = 'admitted' THEN 1 ELSE 0 END) AS admitted FROM leads WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of leads) {
    const r = get(row.service_id as string);
    r.leadsActive = Number(row.active) || 0;
    r.leadsAdmitted = Number(row.admitted) || 0;
  }

  const classes = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(CASE WHEN status IN ('scheduled','in_progress') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM classes WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status IN ('scheduled','in_progress') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM classes WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of classes) {
    const r = get(row.service_id as string);
    r.classesActive = Number(row.active) || 0;
    r.classesCompleted = Number(row.completed) || 0;
  }

  const budget = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending, SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved FROM budget_requests WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending, SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved FROM budget_requests WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of budget) {
    const r = get(row.service_id as string);
    r.budgetPendingAmount = Number(row.pending) || 0;
    r.budgetApprovedAmount = Number(row.approved) || 0;
  }

  const expenses = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(amount) AS total FROM expenses WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(amount) AS total FROM expenses WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of expenses) {
    get(row.service_id as string).expensesTotal = Number(row.total) || 0;
  }

  const compensation = await groupedQuery(orgId, {
    pg: `SELECT service_id, SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) AS count, SUM(CASE WHEN status = 'finalized' THEN net_pay ELSE 0 END) AS total FROM compensation_entries WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) AS count, SUM(CASE WHEN status = 'finalized' THEN net_pay ELSE 0 END) AS total FROM compensation_entries WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of compensation) {
    const r = get(row.service_id as string);
    r.compensationFinalizedCount = Number(row.count) || 0;
    r.compensationNetPayTotal = Number(row.total) || 0;
  }

  return services.map((s) => get(s.id));
}

// Per-person workload — currently Tasks-only, since Tasks is the only
// module with a "who's doing this" field (assignee_name, added this
// phase — see migration 0010). Extending to Leads/Service Requests
// would need their own assignee fields first; noted as a follow-up
// rather than blocking this rollup on retrofitting every module.
export async function getPersonWorkload(orgId: string): Promise<PersonWorkload[]> {
  await ensureTasksSchema();
  const rows = await groupedQuery(orgId, {
    pg: `SELECT assignee_name AS name, COUNT(*) AS active FROM tasks WHERE org_id = $1 AND assignee_name != '' AND status IN ('open','in_progress') GROUP BY assignee_name ORDER BY active DESC`,
    sqlite: `SELECT assignee_name AS name, COUNT(*) AS active FROM tasks WHERE org_id = ? AND assignee_name != '' AND status IN ('open','in_progress') GROUP BY assignee_name ORDER BY active DESC`,
  });
  return rows.map((row) => ({ name: row.name as string, activeTasks: Number(row.active) || 0 }));
}
