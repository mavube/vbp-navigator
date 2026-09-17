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
import { getOrgName } from "@/lib/organizations";

const MAX_BLOCKERS = 8;
const MAX_OVERDUE_TASKS = 8;
const IMPACT_RANK: Record<BlockerImpact, number> = { critical: 3, high: 2, medium: 1, low: 0 };

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
}

export async function buildAiOrgSnapshot(orgId: string): Promise<AiOrgSnapshot> {
  const [orgName, services, rollups, kpi, blockers, leads] = await Promise.all([
    getOrgName(orgId),
    listServices(orgId),
    getServiceRollups(orgId),
    getOrgKpiSummary(orgId),
    listBlockers(orgId),
    listLeads(orgId),
  ]);

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

  return {
    orgName,
    generatedAt: new Date().toISOString(),
    kpi,
    services: serviceSummaries,
    openBlockers,
    overdueTasks,
    pipelineByStage,
  };
}
