import { NextResponse } from "next/server";
import { getServiceRollups, getPersonWorkload, getFiscalYearSummary } from "@/lib/rollups";
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
export async function GET(request: Request) {
  const orgId = await getCurrentOrgId();
  const fyParam = new URL(request.url).searchParams.get("fy");
  const fiscalYear = fyParam ? parseInt(fyParam, 10) : undefined;

  const [services, byPerson, fiscalYears] = await Promise.all([
    getServiceRollups(orgId, fiscalYear),
    getPersonWorkload(orgId),
    getFiscalYearSummary(orgId),
  ]);
  return NextResponse.json({ services, byPerson, fiscalYears, currentFiscalYear: currentFiscalYear() });
}
