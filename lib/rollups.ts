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
import { ensureBlockersSchema } from "@/lib/db-blockers";
import { ensureDocumentsSchema } from "@/lib/db-documents";
import { adjacentFiscalYears, currentFiscalYear, fyLabel } from "@/lib/fiscal-year";
import { computeServiceHealth, type HealthStatus, type ServiceHealthReason } from "@/lib/service-health";

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
    ensureBlockersSchema(),
    ensureDocumentsSchema(),
  ]);
}

export interface ServiceRollup {
  serviceId: string;
  tasksOpen: number;
  tasksDone: number;
  tasksOverdue: number;
  requestsOpen: number;
  requestsResolved: number;
  leadsActive: number;
  leadsWon: number;
  classesActive: number;
  classesCompleted: number;
  budgetPendingAmount: number;
  budgetApprovedAmount: number;
  expensesTotal: number;
  compensationFinalizedCount: number;
  compensationNetPayTotal: number;
  // v3.0 roadmap Phase 7 (Service Health, Capacity Intelligence & KPI
  // Dashboard) additions — every one of these follows the same
  // "compute live, no new table" discipline as everything else in this
  // file. blockersOpen/blockersHighImpact come from the `blockers`
  // table (Phase 6); tasksOverdue is a due_date comparison on `tasks`
  // that already existed; capacityPeople is a distinct-assignee count,
  // the actual "capacity" side of capacity *intelligence* (demand is
  // already derivable from the four *Open/*Active fields above — see
  // lib/service-health.ts); revenueOutgoingTotal/revenueCollectedTotal
  // read the `documents` table's invoice rows (Commercial Documents —
  // the proposal→quotation→invoice chain Sales actually uses, tied to
  // customerId/engagementId/leadId/serviceId) rather than the Budget
  // module's separate `invoices` table. The two tables looked like the
  // same concept but weren't: `documents` is customer-facing and
  // multi-currency-tagged (though summed here as a single amount — an
  // inherited simplification, not new; see the note at the query
  // below), while Budget's `invoices` table has since been narrowed to
  // incoming (vendor bill) rows only and no longer represents money
  // owed to this org. This is the "revenue" this org didn't have a
  // trustworthy number for anywhere before this reconciliation pass.
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

export interface FiscalYearTotals {
  fiscalYear: number;
  label: string;
  budgetApprovedTotal: number;
  expensesTotal: number;
  compensationNetPayTotal: number;
  // Phase 7 addition — same source as ServiceRollup.revenueOutgoingTotal/
  // revenueCollectedTotal, summed org-wide instead of per-service.
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
}

function emptyRollup(serviceId: string): ServiceRollup {
  return {
    serviceId,
    tasksOpen: 0,
    tasksDone: 0,
    tasksOverdue: 0,
    requestsOpen: 0,
    requestsResolved: 0,
    leadsActive: 0,
    leadsWon: 0,
    classesActive: 0,
    classesCompleted: 0,
    budgetPendingAmount: 0,
    budgetApprovedAmount: 0,
    expensesTotal: 0,
    compensationFinalizedCount: 0,
    compensationNetPayTotal: 0,
    blockersOpen: 0,
    blockersHighImpact: 0,
    capacityPeople: 0,
    revenueOutgoingTotal: 0,
    revenueCollectedTotal: 0,
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

  // tasksOverdue: open/in-progress tasks whose due_date has passed.
  // due_date is a plain "YYYY-MM-DD" string on both drivers (an
  // <input type="date"> value — see components/tasks/NewTaskForm.tsx),
  // so a lexical `<` comparison against today's own "YYYY-MM-DD" is a
  // correct chronological comparison without a real date-type cast —
  // same "the ISO text already sorts correctly" reasoning as
  // lib/fiscal-year.ts's substring approach, just full-date instead of
  // year-only. capacityPeople is the distinct-assignee count on the
  // same open/in-progress set — the "capacity" half of capacity
  // intelligence (see lib/service-health.ts for how it's paired with
  // demand).
  const today = new Date().toISOString().slice(0, 10);
  const overdue = await groupedQuery([orgId, today], {
    pg: `SELECT service_id, COUNT(*) AS overdue FROM tasks WHERE org_id = $1 AND status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date::text < $2 GROUP BY service_id`,
    sqlite: `SELECT service_id, COUNT(*) AS overdue FROM tasks WHERE org_id = ? AND status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date < ? GROUP BY service_id`,
  });
  for (const row of overdue) {
    get(row.service_id as string).tasksOverdue = Number(row.overdue) || 0;
  }

  const capacity = await groupedQuery([orgId], {
    pg: `SELECT service_id, COUNT(DISTINCT assignee_name) AS people FROM tasks WHERE org_id = $1 AND status IN ('open','in_progress') AND assignee_name != '' GROUP BY service_id`,
    sqlite: `SELECT service_id, COUNT(DISTINCT assignee_name) AS people FROM tasks WHERE org_id = ? AND status IN ('open','in_progress') AND assignee_name != '' GROUP BY service_id`,
  });
  for (const row of capacity) {
    get(row.service_id as string).capacityPeople = Number(row.people) || 0;
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
    pg: `SELECT service_id, SUM(CASE WHEN stage IN ('new','contacted','qualified') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won FROM leads WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN stage IN ('new','contacted','qualified') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won FROM leads WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of leads) {
    const r = get(row.service_id as string);
    r.leadsActive = Number(row.active) || 0;
    r.leadsWon = Number(row.won) || 0;
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

  // Blockers — status counts only here (the raw open/high-impact
  // counts feed health scoring in lib/service-health.ts); no
  // fiscal-year scoping, since a blocker isn't a financial-value row.
  const blockers = await groupedQuery([orgId], {
    pg: `SELECT service_id, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status = 'open' AND impact IN ('high','critical') THEN 1 ELSE 0 END) AS high FROM blockers WHERE org_id = $1 GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open, SUM(CASE WHEN status = 'open' AND impact IN ('high','critical') THEN 1 ELSE 0 END) AS high FROM blockers WHERE org_id = ? GROUP BY service_id`,
  });
  for (const row of blockers) {
    const r = get(row.service_id as string);
    r.blockersOpen = Number(row.open) || 0;
    r.blockersHighImpact = Number(row.high) || 0;
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

  // Revenue — invoice documents only (VBP billing its own customers via
  // the Commercial Documents proposal→quotation→invoice chain; see
  // lib/db-documents.ts). Proposals and quotations aren't summed here —
  // only doc_type='invoice' rows represent money actually billed.
  // amount IS NOT NULL excludes any invoice still missing a total (line
  // items not yet priced). revenueCollectedTotal narrows to
  // payment_status='paid' — the actually-in-hand subset of
  // revenueOutgoingTotal, the same requested/actual distinction Budget
  // already draws between budgetPendingAmount and budgetApprovedAmount.
  // Known limitation, inherited from the table this replaces rather
  // than introduced by this change: amounts are summed as plain
  // numbers regardless of each document's `currency` field, so this is
  // only correct for an org invoicing in a single currency. Fixing that
  // is unscoped here.
  const revenueParams = fy ? [orgId, fy] : [orgId];
  const revenue = await groupedQuery(revenueParams, {
    pg: `SELECT service_id, SUM(amount) AS total, SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) AS collected FROM documents WHERE org_id = $1 AND doc_type = 'invoice' AND amount IS NOT NULL${fy ? " AND substring(created_at::text from 1 for 4) = $2" : ""} GROUP BY service_id`,
    sqlite: `SELECT service_id, SUM(amount) AS total, SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) AS collected FROM documents WHERE org_id = ? AND doc_type = 'invoice' AND amount IS NOT NULL${fy ? " AND substr(created_at,1,4) = ?" : ""} GROUP BY service_id`,
  });
  for (const row of revenue) {
    const r = get(row.service_id as string);
    r.revenueOutgoingTotal = Number(row.total) || 0;
    r.revenueCollectedTotal = Number(row.collected) || 0;
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
      {
        fiscalYear: fy,
        label: fyLabel(fy),
        budgetApprovedTotal: 0,
        expensesTotal: 0,
        compensationNetPayTotal: 0,
        revenueOutgoingTotal: 0,
        revenueCollectedTotal: 0,
      },
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

  const revenue = await groupedQuery([orgId], {
    pg: `SELECT substring(created_at::text from 1 for 4) AS fy, SUM(amount) AS total, SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) AS collected FROM documents WHERE org_id = $1 AND doc_type = 'invoice' AND amount IS NOT NULL GROUP BY fy`,
    sqlite: `SELECT substr(created_at,1,4) AS fy, SUM(amount) AS total, SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) AS collected FROM documents WHERE org_id = ? AND doc_type = 'invoice' AND amount IS NOT NULL GROUP BY fy`,
  });
  for (const row of revenue) {
    const t = totals.get(Number(row.fy));
    if (t) {
      t.revenueOutgoingTotal = Number(row.total) || 0;
      t.revenueCollectedTotal = Number(row.collected) || 0;
    }
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

export interface AtRiskService {
  serviceId: string;
  serviceName: string;
  status: HealthStatus;
  reasons: ServiceHealthReason[];
}

// v3.0 roadmap Phase 7 — the org-wide numbers behind the new /dashboard
// page. Reuses getServiceRollups (so the same fiscalYear param scopes
// the financial fields the same way it does everywhere else) and
// lib/service-health.ts's per-service scoring, then folds both down to
// org totals — no separate query path, no separate source of truth
// from what the Capabilities page's Health tab shows per service.
export interface OrgKpiSummary {
  fiscalYear: number | undefined;
  activeWork: number;
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
  costTotal: number;
  netTotal: number;
  servicesHealthy: number;
  servicesAttention: number;
  servicesAtRisk: number;
  blockersHighImpactOpen: number;
  tasksOverdue: number;
  atRiskServices: AtRiskService[];
}

export async function getOrgKpiSummary(orgId: string, fiscalYear?: number): Promise<OrgKpiSummary> {
  const services = await listServices(orgId);
  const rollups = await getServiceRollups(orgId, fiscalYear);
  const rollupFor = new Map(rollups.map((r) => [r.serviceId, r]));

  let activeWork = 0;
  let revenueOutgoingTotal = 0;
  let revenueCollectedTotal = 0;
  let costTotal = 0;
  let blockersHighImpactOpen = 0;
  let tasksOverdue = 0;
  let servicesHealthy = 0;
  let servicesAttention = 0;
  let servicesAtRisk = 0;
  const atRiskServices: AtRiskService[] = [];

  for (const s of services) {
    const r = rollupFor.get(s.id) ?? emptyRollup(s.id);
    activeWork += r.tasksOpen + r.requestsOpen + r.leadsActive + r.classesActive;
    revenueOutgoingTotal += r.revenueOutgoingTotal;
    revenueCollectedTotal += r.revenueCollectedTotal;
    costTotal += r.expensesTotal + r.compensationNetPayTotal;
    blockersHighImpactOpen += r.blockersHighImpact;
    tasksOverdue += r.tasksOverdue;

    const health = computeServiceHealth({ id: s.id, providerId: s.providerId }, r);
    if (health.status === "at_risk") {
      servicesAtRisk += 1;
      atRiskServices.push({ serviceId: s.id, serviceName: s.name, status: health.status, reasons: health.reasons });
    } else if (health.status === "attention") {
      servicesAttention += 1;
    } else {
      servicesHealthy += 1;
    }
  }

  return {
    fiscalYear,
    activeWork,
    revenueOutgoingTotal,
    revenueCollectedTotal,
    costTotal,
    netTotal: revenueCollectedTotal - costTotal,
    servicesHealthy,
    servicesAttention,
    servicesAtRisk,
    blockersHighImpactOpen,
    tasksOverdue,
    atRiskServices,
  };
}
