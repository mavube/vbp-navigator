// v3.0 roadmap Phase 8 — AI Operating Layer (§19). Builds the one thing
// the AI layer is ever allowed to reason over: a snapshot assembled
// exclusively from `orgId`-scoped queries, the same boundary every
// other lib/db-*.ts module already enforces. There is no separate
// "AI access control" to get right or wrong here — the model only ever
// sees what this function returns, and this function only ever asks
// for one org's rows, so cross-tenant leakage is prevented the same
// structural way it already is everywhere else in this app.
//
// Deliberately condensed, not a raw dump of every table: top blockers
// by impact, a bounded number of overdue tasks, pipeline counts by
// stage rather than every lead's contact details. Keeps the prompt
// small (cost, latency) and avoids handing a chat model more personal
// data than the Observe/Understand/Advise task actually needs.

import { listServices } from "@/lib/db-services";
import { getServiceRollups, getOrgKpiSummary, type OrgKpiSummary } from "@/lib/rollups";
import { computeServiceHealth } from "@/lib/service-health";
import { listBlockers, type BlockerImpact } from "@/lib/db-blockers";
import { listTasks } from "@/lib/db-tasks";
import { listLeads } from "@/lib/db-leads";
import { listProspects } from "@/lib/db-prospects";
import { listClasses } from "@/lib/db-classes";
import { listEnrollments } from "@/lib/db-enrollments";
import { listDocuments } from "@/lib/db-documents";
import { listServiceRequests } from "@/lib/db-service-requests";
import { getOrgName } from "@/lib/organizations";
import { listMemory, ensureTodaySnapshot, getPriorSnapshot } from "@/lib/db-org-memory";

const MAX_BLOCKERS = 8;
const MAX_OVERDUE_TASKS = 8;
const MAX_AGING_ITEMS = 8;
const MAX_UPCOMING_CLASSES = 8;
const MAX_MEMORY_ITEMS = 8;
const IMPACT_RANK: Record<BlockerImpact, number> = { critical: 3, high: 2, medium: 1, low: 0 };

// v3.0 roadmap Cluster E (AI Advisor expansion) — the enhancement
// backlog named five specific blind spots in the Phase 8 snapshot:
// budget/compensation data entirely, task completion velocity,
// lead/prospect stage-dwell (aging), class enrollment fill-rate, and
// document/service-request backlog age. Trend vs. a prior snapshot
// ("this got worse this week") was deliberately NOT built in Cluster E
// — Diallo chose to skip it then (2026-09-17) because it depended on
// the roadmap's own Phase 9 (Organizational Memory, §17), which didn't
// exist yet. Phase 13 (this file's `trend`/`recentMemory` additions,
// below) is that Phase 9, so the gap is now closed.
function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

export interface AiOrgSnapshot {
  orgName: string;
  generatedAt: string;
  kpi: OrgKpiSummary;
  services: Array<{
    name: string;
    type: "cvs" | "enabling";
    department: string;
    hasProvider: boolean;
    hasBackup: boolean;
    outcome: string;
    health: { status: string; reasons: string[]; capacity: string; demand: number; people: number };
  }>;
  openBlockers: Array<{ title: string; serviceName: string; impact: BlockerImpact; ownerName: string; requiredAction: string }>;
  overdueTasks: Array<{ title: string; serviceName: string; dueDate: string | null; assigneeName: string }>;
  pipelineByStage: Record<string, number>;
  // Cluster E additions below — see the module header comment for what
  // each one closes and why trend/history is deliberately absent.
  budgetCompensation: {
    budgetPendingTotal: number;
    budgetApprovedTotal: number;
    compensationFinalizedCount: number;
    compensationNetPayTotal: number;
  };
  // Proxy, not a dedicated field: tasks have no separate "completedAt"
  // timestamp, so a task's own updated_at at the moment its status was
  // set to done is what's used — the same approximation the rest of
  // this app makes wherever a status-change timestamp stands in for a
  // purpose-built one (e.g. a document's updatedAt on approval).
  taskVelocity: { completedLast7Days: number; completedLast30Days: number };
  // Leads still actively in the pipeline (not yet won/lost),
  // oldest-in-current-stage first — "stage" not "creation", since a
  // lead that's been sitting in the same stage for weeks is the actual
  // signal, not one that's simply been open a while but moving.
  pipelineAging: Array<{ contactName: string; serviceName: string; stage: string; daysInStage: number }>;
  // Prospects not yet promoted or declined, oldest-waiting first.
  prospectAging: Array<{ fullName: string; source: string; status: string; daysWaiting: number }>;
  // "Fill-rate" (the backlog's own word) turned out not to be buildable
  // as written: classes have no seat-capacity field anywhere in the
  // schema (supabase/migrations/0005, 0017) to compute a rate against.
  // What's real and useful instead: each upcoming/active class's actual
  // roster size, so the model can flag one that looks thin — the same
  // "correct the audit's wording against what the schema actually
  // supports" call this project has made before (e.g. Phase 11's
  // Calendar/blocker-deadline correction).
  classEnrollment: Array<{ title: string; serviceName: string; scheduledDate: string | null; enrolledCount: number }>;
  backlogAge: {
    documentsOldest: Array<{ docType: string; serviceName: string; status: string; daysOpen: number }>;
    serviceRequestsOldest: Array<{ title: string; serviceName: string; priority: string; daysOpen: number }>;
  };
  // Phase 13 (v3.0 roadmap Phase 9, §17 — Organizational Memory)
  // additions below. `trend` is null until an org has a snapshot from
  // an earlier UTC day to diff against (see lib/db-org-memory.ts's
  // ensureTodaySnapshot/getPriorSnapshot) — never a fabricated zero.
  // Positive deltas mean "more/higher than the prior snapshot," for
  // every field including the ones where more is bad (e.g.
  // tasksOverdue, servicesAtRisk) — the model's system prompt is what's
  // told which direction is good per field, not this data shape.
  trend: {
    sinceDate: string;
    daysAgo: number;
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
  } | null;
  // Newest-first decision/lesson entries anyone in the org has logged
  // (`/memory`) — the "historical pattern-matching" the roadmap's own
  // Phase 9 description says should feed the AI layer. Capped the same
  // MAX_BLOCKERS-style way every other list in this snapshot is.
  recentMemory: Array<{ type: "decision" | "lesson"; title: string; body: string; serviceName: string | null; daysAgo: number }>;
}

export async function buildAiOrgSnapshot(orgId: string): Promise<AiOrgSnapshot> {
  const [orgName, services, rollups, kpi, blockers, leads, prospects, classes, documents, serviceRequests, priorSnapshot, memory] =
    await Promise.all([
      getOrgName(orgId),
      listServices(orgId),
      getServiceRollups(orgId),
      getOrgKpiSummary(orgId),
      listBlockers(orgId),
      listLeads(orgId),
      listProspects(orgId),
      listClasses(orgId),
      listDocuments(orgId),
      listServiceRequests(orgId),
      getPriorSnapshot(orgId),
      listMemory(orgId, MAX_MEMORY_ITEMS),
    ]);

  // Opportunistic capture (no cron in this app) — idempotent per org
  // per UTC day, so every "Generate insights" click after the first
  // one today is a harmless no-op. Read via `priorSnapshot` above,
  // which deliberately excludes today so a snapshot never diffs
  // against itself.
  await ensureTodaySnapshot(orgId, kpi);

  const rollupFor = new Map(rollups.map((r) => [r.serviceId, r]));
  const serviceNameFor = new Map(services.map((s) => [s.id, s.name]));

  const serviceSummaries = services.map((s) => {
    const rollup = rollupFor.get(s.id)!;
    const health = computeServiceHealth({ id: s.id, providerId: s.providerId }, rollup);
    return {
      name: s.name,
      type: s.type,
      department: s.department,
      hasProvider: !!s.providerId,
      hasBackup: !!s.backupId,
      outcome: s.outcome,
      // v3.0 roadmap Phase 9 gave ServiceHealth.reasons a drill-down
      // `href` for the UI (lib/service-health.ts) — the model has no use
      // for a link, so only the plain text crosses into the prompt.
      health: {
        status: health.status,
        reasons: health.reasons.map((r) => r.text),
        capacity: health.capacity,
        demand: health.demand,
        people: health.people,
      },
    };
  });

  const openBlockers = blockers
    .filter((b) => b.status === "open")
    .sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact])
    .slice(0, MAX_BLOCKERS)
    .map((b) => ({
      title: b.title,
      serviceName: serviceNameFor.get(b.serviceId) ?? "Unknown service",
      impact: b.impact,
      ownerName: b.ownerName || "Unassigned",
      requiredAction: b.requiredAction,
    }));

  // No single "overdue tasks across the whole org" query exists yet
  // (lib/rollups.ts's tasksOverdue is a per-service count, not a list) —
  // pulling every service's task list and filtering here is fine at
  // the org sizes this app targets (a handful of people, a handful of
  // services); a dedicated query is a fair follow-up if that stops
  // being true.
  const today = new Date().toISOString().slice(0, 10);
  const allTasks = (await Promise.all(services.map((s) => listTasks(orgId, s.id)))).flat();
  const overdueTasks = allTasks
    .filter((t) => (t.status === "open" || t.status === "in_progress") && t.dueDate && t.dueDate < today)
    .slice(0, MAX_OVERDUE_TASKS)
    .map((t) => ({
      title: t.title,
      serviceName: serviceNameFor.get(t.serviceId) ?? "Unknown service",
      dueDate: t.dueDate,
      assigneeName: t.assigneeName || "Unassigned",
    }));

  const pipelineByStage: Record<string, number> = {};
  for (const lead of leads) {
    pipelineByStage[lead.stage] = (pipelineByStage[lead.stage] ?? 0) + 1;
  }

  // Budget/compensation — reuses the rollups already fetched above for
  // health scoring rather than a second set of queries; the amounts are
  // the exact same numbers Capabilities/Dashboard show, summed org-wide.
  const budgetCompensation = rollups.reduce(
    (acc, r) => ({
      budgetPendingTotal: acc.budgetPendingTotal + r.budgetPendingAmount,
      budgetApprovedTotal: acc.budgetApprovedTotal + r.budgetApprovedAmount,
      compensationFinalizedCount: acc.compensationFinalizedCount + r.compensationFinalizedCount,
      compensationNetPayTotal: acc.compensationNetPayTotal + r.compensationNetPayTotal,
    }),
    { budgetPendingTotal: 0, budgetApprovedTotal: 0, compensationFinalizedCount: 0, compensationNetPayTotal: 0 }
  );

  // Task completion velocity — see this file's AiOrgSnapshot comment on
  // why updatedAt is the proxy used here.
  const nowMs = Date.now();
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const taskVelocity = {
    completedLast7Days: doneTasks.filter((t) => nowMs - new Date(t.updatedAt).getTime() <= 7 * 86_400_000).length,
    completedLast30Days: doneTasks.filter((t) => nowMs - new Date(t.updatedAt).getTime() <= 30 * 86_400_000).length,
  };

  // Pipeline aging — active leads (not yet won/lost), oldest time
  // in their current stage first. updatedAt is what a stage PATCH bumps
  // (app/api/leads/[id]/route.ts), so it's the real "time in this
  // stage" signal, not just "time since creation."
  const pipelineAging = leads
    .filter((l) => l.stage !== "won" && l.stage !== "lost")
    .map((l) => ({
      contactName: l.contactName,
      serviceName: serviceNameFor.get(l.serviceId) ?? "Unknown service",
      stage: l.stage,
      daysInStage: daysSince(l.updatedAt),
    }))
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, MAX_AGING_ITEMS);

  // Prospect aging — not yet promoted or declined, oldest-waiting first.
  const prospectAging = prospects
    .filter((p) => p.status === "new" || p.status === "reviewed")
    .map((p) => ({
      fullName: p.fullName || "(no name given)",
      source: p.source,
      status: p.status,
      daysWaiting: daysSince(p.createdAt),
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, MAX_AGING_ITEMS);

  // Class enrollment — see the AiOrgSnapshot comment on why this is
  // roster size, not a "fill-rate" (no capacity field exists to divide
  // by). Scoped to upcoming/active classes only — a completed or
  // cancelled class's final roster isn't an operational signal anymore.
  const upcomingClasses = classes
    .filter((c) => c.status === "scheduled" || c.status === "in_progress")
    .slice(0, MAX_UPCOMING_CLASSES);
  const classEnrollment = await Promise.all(
    upcomingClasses.map(async (c) => {
      const enrollments = await listEnrollments(orgId, c.id);
      return {
        title: c.title,
        serviceName: serviceNameFor.get(c.serviceId) ?? "Unknown service",
        scheduledDate: c.scheduledDate,
        enrolledCount: enrollments.filter((e) => e.status === "enrolled").length,
      };
    })
  );

  // Backlog age — documents still in draft/pending_approval, and
  // service requests still open/in_progress, both oldest-first by
  // createdAt (there's no separate "entered this status" timestamp for
  // either, same limitation daysInStage above works around for Leads
  // via updatedAt — these two don't have that same PATCH-bumps-it
  // guarantee tied to status specifically, so createdAt is the honest
  // choice here rather than reusing updatedAt and overstating precision).
  const documentsOldest = documents
    .filter((d) => d.status === "draft" || d.status === "pending_approval")
    .map((d) => ({
      docType: d.docType,
      serviceName: serviceNameFor.get(d.serviceId) ?? "Unknown service",
      status: d.status,
      daysOpen: daysSince(d.createdAt),
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, MAX_AGING_ITEMS);

  const serviceRequestsOldest = serviceRequests
    .filter((r) => r.status === "open" || r.status === "in_progress")
    .map((r) => ({
      title: r.title,
      serviceName: serviceNameFor.get(r.serviceId) ?? "Unknown service",
      priority: r.priority,
      daysOpen: daysSince(r.createdAt),
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, MAX_AGING_ITEMS);

  // Trend — null when there's no earlier-day snapshot yet (see this
  // file's AiOrgSnapshot comment on `trend`). Deltas are live-minus-
  // prior, computed here rather than stored, so they always reflect
  // the current live kpi even though the comparison point is a
  // once-a-day capture.
  const trend = priorSnapshot
    ? {
        sinceDate: priorSnapshot.snapshotDate,
        daysAgo: daysSince(priorSnapshot.createdAt),
        activeWork: kpi.activeWork - priorSnapshot.activeWork,
        revenueOutgoingTotal: kpi.revenueOutgoingTotal - priorSnapshot.revenueOutgoingTotal,
        revenueCollectedTotal: kpi.revenueCollectedTotal - priorSnapshot.revenueCollectedTotal,
        costTotal: kpi.costTotal - priorSnapshot.costTotal,
        netTotal: kpi.netTotal - priorSnapshot.netTotal,
        servicesHealthy: kpi.servicesHealthy - priorSnapshot.servicesHealthy,
        servicesAttention: kpi.servicesAttention - priorSnapshot.servicesAttention,
        servicesAtRisk: kpi.servicesAtRisk - priorSnapshot.servicesAtRisk,
        blockersHighImpactOpen: kpi.blockersHighImpactOpen - priorSnapshot.blockersHighImpactOpen,
        tasksOverdue: kpi.tasksOverdue - priorSnapshot.tasksOverdue,
      }
    : null;

  const recentMemory = memory.map((m) => ({
    type: m.type,
    title: m.title,
    body: m.body,
    serviceName: m.serviceId ? serviceNameFor.get(m.serviceId) ?? "Unknown service" : null,
    daysAgo: daysSince(m.createdAt),
  }));

  return {
    orgName,
    generatedAt: new Date().toISOString(),
    kpi,
    services: serviceSummaries,
    openBlockers,
    overdueTasks,
    pipelineByStage,
    budgetCompensation,
    taskVelocity,
    pipelineAging,
    prospectAging,
    classEnrollment,
    backlogAge: { documentsOldest, serviceRequestsOldest },
    trend,
    recentMemory,
  };
}
