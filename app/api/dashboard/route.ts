import { NextResponse } from "next/server";
import { getOrgKpiSummary, getFiscalYearSummary } from "@/lib/rollups";
import { currentFiscalYear } from "@/lib/fiscal-year";
import { getCurrentOrgId } from "@/lib/current-org";
import { ensureTodaySnapshot } from "@/lib/db-org-memory";

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

  // Phase 13 (v3.0 roadmap Phase 9, §17) — opportunistic, idempotent
  // once-a-day KPI capture so lib/ai-context.ts has a real prior
  // snapshot to diff against. Captures the all-fiscal-year reading
  // (fiscalYear undefined), same scope the Advisor sees, regardless of
  // which `fy` this particular request asked the Dashboard for — this
  // route is simply the other opportunistic trigger for the same
  // capture the Advisor's observe route also makes. Awaited (not
  // fire-and-forget) because a Vercel serverless function can be frozen
  // the instant its response is sent, which would silently drop an
  // un-awaited write — but a capture failure never fails the Dashboard
  // response itself.
  if (!fiscalYear) {
    await ensureTodaySnapshot(orgId, summary).catch((err) => console.error("KPI snapshot capture failed:", err));
  }

  return NextResponse.json({ summary, fiscalYears, currentFiscalYear: currentFiscalYear() });
}
