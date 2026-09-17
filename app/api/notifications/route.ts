import { NextResponse } from "next/server";
import { getOrgKpiSummary } from "@/lib/rollups";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/notifications — v3.0 roadmap Phase 11 (Cluster D)'s Topbar
// notifications bell: "a notifications surface for critical blockers/
// overdue tasks (data already computed for the Advisor)." Reuses
// lib/rollups.ts's getOrgKpiSummary rather than a new query path — the
// exact same numbers the Dashboard KPI cards and Sidebar badges already
// show, so the bell can never disagree with either of them.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const summary = await getOrgKpiSummary(orgId);
  return NextResponse.json({
    tasksOverdue: summary.tasksOverdue,
    blockersHighImpactOpen: summary.blockersHighImpactOpen,
    atRiskServices: summary.atRiskServices,
  });
}
