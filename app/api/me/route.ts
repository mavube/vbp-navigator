import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

// GET /api/me — v3.0 roadmap Phase 11 (Cluster D): the Sidebar/Topbar
// identity block (org name, signed-in email, sign-out). Read-only, no
// gate beyond being in the org — same visibility as every other
// org-wide read in this app.
export async function GET() {
  const identity = await getIdentity();
  return NextResponse.json(identity);
}
