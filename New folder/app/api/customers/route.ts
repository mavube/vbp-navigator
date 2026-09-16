import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/db-customers";
import { listEngagements } from "@/lib/db-engagements";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/customers — every customer this org has, each admitted from
// a Lead (see app/api/leads/[id]/route.ts), plus every Engagement
// (customer + service pairing) so the client can join them without a
// second round trip — same "small org, join client-side" pattern
// ArchitectureView and Capabilities already use. Read-only, same
// org-wide visibility as everything else here.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const [customers, engagements] = await Promise.all([listCustomers(orgId), listEngagements(orgId)]);
  return NextResponse.json({ customers, engagements });
}
