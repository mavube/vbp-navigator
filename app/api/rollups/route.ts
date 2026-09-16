import { NextResponse } from "next/server";
import { getServiceRollups, getPersonWorkload } from "@/lib/rollups";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/rollups — the Phase 7 reporting layer: per-service active
// item counts (Workload) and completed/value counts (Outcomes), plus
// per-person task workload. Read-only, no permission gate beyond being
// in the org — same visibility as the Service Architecture view itself.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const [services, byPerson] = await Promise.all([getServiceRollups(orgId), getPersonWorkload(orgId)]);
  return NextResponse.json({ services, byPerson });
}
