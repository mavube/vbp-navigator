import { NextResponse } from "next/server";
import { listFindings, seedMissing } from "@/lib/db";
import { FINDINGS } from "@/lib/findings-data";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/findings — full current state of all findings for the caller's
// org, seeding any that don't exist yet (first run for a fresh org).
export async function GET() {
  const orgId = await getCurrentOrgId();
  await seedMissing(orgId, FINDINGS.map((f) => f.id));
  const rows = await listFindings(orgId);
  return NextResponse.json(rows);
}
