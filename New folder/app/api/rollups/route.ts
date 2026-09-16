import { NextResponse } from "next/server";
import { getServiceRollups, getPersonWorkload, getFiscalYearSummary } from "@/lib/rollups";
import { computeServiceHealth } from "@/lib/service-health";
import { listServices } from "@/lib/db-services";
import { currentFiscalYear } from "@/lib/fiscal-year";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/rollups[?fy=2026] — the Phase 7 reporting layer: per-service
// active item counts (Workload) and completed/value counts (Outcomes),
// plus per-person task workload. Read-only, no permission gate beyond
// being in the org — same visibility as the Service Architecture view
// itself.
//
// v3.0 roadmap Phase 3: an optional `fy` query param scopes the three
// financial-value fields (budget/expenses/compensation) on `services`
// to that calendar year — see lib/rollups.ts's getServiceRollups. The
// response also always includes `fiscalYears`, the org-wide previous/
// current/next FY comparison (unaffected by `fy` — it's inherently a
// three-year-at-once view), and `currentFiscalYear` so the UI knows
// what "this year" means without computing it client-side.
//
// v3.0 roadmap Phase 7: the response also includes `health` — one
// lib/service-health.ts score per service, computed here (server side)
// from the same rollup numbers already being fetched, so the
// Capabilities page's new Health tab and the org-wide /dashboard page
// are reading the identical scoring logic rather than two.
export async function GET(request: Request) {
  const orgId = await getCurrentOrgId();
  const fyParam = new URL(request.url).searchParams.get("fy");
  const fiscalYear = fyParam ? parseInt(fyParam, 10) : undefined;

  const [serviceList, rollups, byPerson, fiscalYears] = await Promise.all([
    listServices(orgId),
    getServiceRollups(orgId, fiscalYear),
    getPersonWorkload(orgId),
    getFiscalYearSummary(orgId),
  ]);
  const rollupFor = new Map(rollups.map((r) => [r.serviceId, r]));
  const health = serviceList.map((s) =>
    computeServiceHealth({ id: s.id, providerId: s.providerId }, rollupFor.get(s.id)!)
  );

  return NextResponse.json({
    services: rollups,
    byPerson,
    fiscalYears,
    currentFiscalYear: currentFiscalYear(),
    health,
  });
}
