import { NextResponse } from "next/server";
import { getOrgKpiSummary, getFiscalYearSummary } from "@/lib/rollups";
import { currentFiscalYear } from "@/lib/fiscal-year";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/dashboard[?fy=2026] — v3.0 roadmap Phase 7's "real KPI
// Dashboard" (§15-16, §18, §25): one org-wide summary (active work,
// revenue/cost/net, at-risk services, open critical blockers, overdue
// tasks) plus the same three-year FY trend Capabilities' Outcomes tab
// already shows, now including revenue. Read-only, same org-wide
// visibility as Capabilities/Architecture — no permission gate beyond
// being in the org.
export async function GET(request: Request) {
  const orgId = await getCurrentOrgId();
  const fyParam = new URL(request.url).searchParams.get("fy");
  const fiscalYear = fyParam ? parseInt(fyParam, 10) : undefined;

  const [summary, fiscalYears] = await Promise.all([getOrgKpiSummary(orgId, fiscalYear), getFiscalYearSummary(orgId)]);
  return NextResponse.json({ summary, fiscalYears, currentFiscalYear: currentFiscalYear() });
}
