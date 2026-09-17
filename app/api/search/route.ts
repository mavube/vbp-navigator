import { NextRequest, NextResponse } from "next/server";
import { globalSearch } from "@/lib/search";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/search?q=... — v3.0 roadmap Phase 11 (Cluster D)'s Topbar
// global search. Same org-wide read visibility as every list endpoint
// this pulls from (services/tasks/leads/classes/customers/prospects);
// see lib/search.ts for why this filters in-process instead of a new
// per-table SQL query.
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(orgId, q);
  return NextResponse.json(results);
}
