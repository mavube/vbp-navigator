// The Phase 7 reporting layer — Capabilities/Workload + Outcomes
// metrics. Deliberately not its own table: every number here is a live
// COUNT/SUM over tables that already exist (tasks, leads, classes,
// service_requests, budget_requests, expenses, compensation_entries),
// grouped by service_id. That keeps the numbers always-accurate with
// nothing to go stale, and — same non-hardcoding discipline as
// Pipeline's no-auto-transition (Phase 3 of v2.0) and Classes'
// service-tagging (Phase 4) — it computes the *same* metrics for every
// service regardless of type, rather than special-casing "Master Class
// Delivery" or "Compensation Earning Service" by name, which would
// break for any tenant with a different catalog.
//
// "Workload" and "Outcomes" are two lenses on the same underlying
// counts: active/open items per service is a capacity signal
// (Workload); completed/finalized items and amounts per service is a
// throughput/value signal (Outcomes) — see ServiceRollup below, which
// carries both.
//
// v3.0 roadmap Phase 3 (Financial Year dimension) added optional
// fiscal-year filtering to the three financial-value fields
// (budget/expenses/compensation) and a separate org-wide prev/current/
// next FY comparison — see the fiscalYear param on getServiceRollups
// and getFiscalYearSummary below, plus lib/fiscal-year.ts for why FY is
// computed from existing date columns rather than a stored column.

import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { listServices } from "@/lib/db-services";
import { ensureTasksSchema } from "@/lib/db-tasks";
import { ensureServiceRequestsSchema } from "@/lib/db-service-requests";
import { ensureLeadsSchema } from "@/lib/db-leads";
import { ensureClassesSchema } from "@/lib/db-classes";
import { ensureBudgetSchema } from "@/lib/db-budget";
import { ensureExpensesSchema } from "@/lib/db-expenses";
import { ensureCompensationSchema } from "@/lib/db-compensation";
import { adjacentFiscalYears, currentFiscalYear, fyLabel } from "@/lib/fiscal-year";

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

export interface FiscalYearTotals {
  fiscalYear: number;
  label: string;
  budgetApprovedTotal: number;
  expensesTotal: number;
  compensationNetPayTotal: number;
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

// Runs one grouped aggregation query and returns rows in a shape that's
// the same from either driver — each metric below is just "run this
// query, merge these columns into the rollup map." `params` is passed
// straight through positionally (pg's $1/$2/... vs. sqlite's ?/?/...).
async function groupedQuery(params: unknown[], sql: { pg: string; sqlite: string }): Promise<Record<string, unknown>[]> {
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(sql.pg, params);
    return res.rows;
  }
  return (await getSqliteDb()).prepare(sql.sqlite).all(...params) as Record<string, unknown>[];
}

// fiscalYear, when given, scopes budgetPendingAmount/budgetApprovedAmount/
// expensesTotal/compensationFinalizedCount/compensationNetPayTotal to
// that calendar year — the three financial-value tables the v3.0
// roadmap's Phase 3 names (Budget, Compensation). Tasks/Requests/Leads/
// Classes are operational counts with no financial-year dimension, so
// they stay all-time regardless of this param.
export async function getServiceRollups(orgId: string, fiscalYear?: number): Promise<ServiceRollup[]> {
  await ensureAllSchemas();
  const services = await listServices(orgId);
  const rollups = new Map<string, ServiceRollup>(services.map((s) => [s.id, emptyRollup(s.id)]));
  const get = (serviceId: string) => rollups.get(serviceId) ?? rollups.set(serviceId, emptyRollup(serviceId)).get(serviceId)!;

  const tasks = await groupedQuery([orgId], {
    pg: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done FROM tasks WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done FROM tasks WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of tasks) {
    const r = get(row.service_id as string);
    r.tasksOpen = Number(row.open) || 0;
    r.tasksDone = Number(row.done) || 0;
  }

  const requests = await groupedQuery([orgId], {
    pg: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved FROM service_requests WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved FROM service_requests WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of requests) {
    const r = get(row.service_id as string);
    r.requestsOpen = Number(row.open) || 0;
    r.requestsResolved = Number(row.resolved) || 0;
  }

  const leads = await groupedQuery([orgId], {
    pg: `SELECT service_id, SUM(CASE WHEN stage IN ('new','contacted','assessed') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN stage = 'admitted' THEN 1 ELSE 0 END) AS admitted FROM leads WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN stage IN ('new','contacted','assessed') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN stage = 'admitted' THEN 1 ELSE 0 END) AS admitted FROM leads WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of leads) {
    const r = get(row.service_id as string);
    r.leadsActive = Number(row.active) || 0;
    r.leadsAdmitted = Number(row.admitted) || 0;
  }

  const classes = await groupedQuery([orgId], {
    pg: `SELECT service_id, SUM(CASE WHEN status IN ('scheduled','in_progress') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM classes WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status IN ('scheduled','in_progress') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM classes WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of classes) {
    const r = get(row.service_id as string);
    r.classesActive = Number(row.active) || 0;
    r.classesCompleted = Number(row.completed) || 0;
  }

  // fy, when set, is bound as a 4-char text param and compared against
  // a substring of the relevant date column — see lib/fiscal-year.ts's
  // header comment for why this is a substring rather than EXTRACT()/a
  // real date parse: identical logic works unchanged against Postgres's
  // timestamptz/date columns (cast to text first) and SQLite's TEXT
  // columns, since both store the same ISO-8601-leading-with-year shape.
  const fy = fiscalYear !== undefined ? String(fiscalYear) : null;
  const budgetParams = fy ? [orgId, fy] : [orgId];
  const budget = await groupedQuery(budgetParams, {
    pg: `SELECT service_id, SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending, SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved FROM budget_requests WHERE org_id = $1${fy ? " AND substring(created_at::text from 1 for 4) = $2" : ""} GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending, SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved FROM budget_requests WHERE org_id = ?${fy ? " AND substr(created_at,1,4) = ?" : ""} GROUP BY service_id`,
  });
  for (const row of budget) {
    const r = get(row.service_id as string);
    r.budgetPendingAmount = Number(row.pending) || 0;
    r.budgetApprovedAmount = Number(row.approved) || 0;
  }

  const expensesParams = fy ? [orgId, fy] : [orgId];
  const expenses = await groupedQuery(expensesParams, {
    pg: `SELECT service_id, SUM(amount) AS total FROM expenses WHERE org_id = $1${fy ? " AND substring(expense_date::text from 1 for 4) = $2" : ""} GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(amount) AS total FROM expenses WHERE org_id = ?${fy ? " AND substr(expense_date,1,4) = ?" : ""} GROUP BY service_id`,
  });
  for (const row of expenses) {
    get(row.service_id as string).expensesTotal = Number(row.total) || 0;
  }

  const compensationParams = fy ? [orgId, fy] : [orgId];
  const compensation = await groupedQuery(compensationParams, {
    pg: `SELECT service_id, SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) AS count, SUM(CASE WHEN status = 'finalized' THEN net_pay ELSE 0 END) AS total FROM compensation_entries WHERE org_id = $1${fy ? " AND substring(period from 1 for 4) = $2" : ""} GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) AS count, SUM(CASE WHEN status = 'finalized' THEN net_pay ELSE 0 END) AS total FROM compensation_entries WHERE org_id = ?${fy ? " AND substr(period,1,4) = ?" : ""} GROUP BY service_id`,
  });
  for (const row of compensation) {
    const r = get(row.service_id as string);
    r.compensationFinalizedCount = Number(row.count) || 0;
    r.compensationNetPayTotal = Number(row.total) || 0;
  }

  return services.map((s) => get(s.id));
}

// Org-wide "previous FY / current FY / next FY" comparison — v3.0
// roadmap Phase 3. Deliberately org-wide, not per-service (the
// fiscalYear param on getServiceRollups above is what gives the
// per-service breakdown for a single chosen year); this is the
// three-year-at-once view for judging trajectory. "Next FY" will
// usually read all-zero until real forward spend/payroll exists —
// returned as zero rather than omitted, since an honest "nothing yet"
// is more useful than a row that silently isn't there.
export async function getFiscalYearSummary(orgId: string, centerFy: number = currentFiscalYear()): Promise<FiscalYearTotals[]> {
  await ensureAllSchemas();
  const years = adjacentFiscalYears(centerFy);
  const totals = new Map<number, FiscalYearTotals>(
    years.map((fy) => [
      fy,
      { fiscalYear: fy, label: fyLabel(fy), budgetApprovedTotal: 0, expensesTotal: 0, compensationNetPayTotal: 0 },
    ])
  );

  const budget = await groupedQuery([orgId], {
    pg: `SELECT substring(created_at::text from 1 for 4) AS fy, SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved FROM budget_requests WHERE org_id = $1 GROUP BY fy`,
    sqlite: `SELECT substr(created_at,1,4) AS fy, SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved FROM budget_requests WHERE org_id = ? GROUP BY fy`,
  });
  for (const row of budget) {
    const t = totals.get(Number(row.fy));
    if (t) t.budgetApprovedTotal = Number(row.approved) || 0;
  }

  const expenses = await groupedQuery([orgId], {
    pg: `SELECT substring(expense_date::text from 1 for 4) AS fy, SUM(amount) AS total FROM expenses WHERE org_id = $1 GROUP BY fy`,
    sqlite: `SELECT substr(expense_date,1,4) AS fy, SUM(amount) AS total FROM expenses WHERE org_id = ? GROUP BY fy`,
  });
  for (const row of expenses) {
    const t = totals.get(Number(row.fy));
    if (t) t.expensesTotal = Number(row.total) || 0;
  }

  const compensation = await groupedQuery([orgId], {
    pg: `SELECT substring(period from 1 for 4) AS fy, SUM(CASE WHEN status = 'finalized' THEN net_pay ELSE 0 END) AS total FROM compensation_entries WHERE org_id = $1 GROUP BY fy`,
    sqlite: `SELECT substr(period,1,4) AS fy, SUM(CASE WHEN status = 'finalized' THEN net_pay ELSE 0 END) AS total FROM compensation_entries WHERE org_id = ? GROUP BY fy`,
  });
  for (const row of compensation) {
    const t = totals.get(Number(row.fy));
    if (t) t.compensationNetPayTotal = Number(row.total) || 0;
  }

  return years.map((fy) => totals.get(fy)!);
}

// Per-person workload — currently Tasks-only, since Tasks is the only
// module with a "who's doing this" field (assignee_name, added in v2.0
// Phase 7). Extending to Leads/Service Requests would need their own
// assignee fields first; noted as a follow-up rather than retrofitting
// every module in this phase.
export async function getPersonWorkload(orgId: string): Promise<PersonWorkload[]> {
  await ensureTasksSchema();
  const rows = await groupedQuery([orgId], {
    pg: `SELECT assignee_name AS name, COUNT(*) AS active FROM tasks WHERE org_id = $1 AND assignee_name != '' AND status IN ('open','in_progress') GROUP BY assignee_name ORDER BY active DESC`,
    sqlite: `SELECT assignee_name AS name, COUNT(*) AS active FROM tasks WHERE org_id = ? AND assignee_name != '' AND status IN ('open','in_progress') GROUP BY assignee_name ORDER BY active DESC`,
  });
  return rows.map((row) => ({ name: row.name as string, activeTasks: Number(row.active) || 0 }));
}
