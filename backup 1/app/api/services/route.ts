import { NextResponse } from "next/server";
import { listServices } from "@/lib/db-services";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/services — the caller's org's service catalog. Read-only for
// now; creating/editing services is still done via SQL (see
// supabase/seed/vbp_services.sql) until a Settings module exists.
export async function GET() {
  const orgId = await getCurrentOrgId();
  const services = await listServices(orgId);
  return NextResponse.json(services);
}
