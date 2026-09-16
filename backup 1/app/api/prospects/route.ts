import { NextResponse } from "next/server";
import { listProspects } from "@/lib/db-prospects";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/prospects — everyone submitted via /apply and /assess for
// this org, newest first. Same org-wide visibility as Leads — no extra
// gate beyond being in the org.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const prospects = await listProspects(orgId);
  return NextResponse.json(prospects);
}
