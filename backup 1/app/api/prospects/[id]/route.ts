import { NextRequest, NextResponse } from "next/server";
import { updateProspectStatus, type ProspectStatus } from "@/lib/db-prospects";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ProspectStatus[] = ["new", "reviewed", "declined"];

// PATCH /api/prospects/:id — mark reviewed or declined. Promoting to a
// Lead goes through POST /api/prospects/:id/promote instead (it needs
// a serviceId and creates a second record) — this route only ever
// moves status among the "didn't become a lead" states. Open to any
// signed-in org member, same as reviewing a Lead's stage; there's no
// per-service ownership to check here since a prospect hasn't been
// assigned to a service's pipeline yet.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as ProspectStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const orgId = await getCurrentOrgId();
  await updateProspectStatus(orgId, id, body.status as ProspectStatus);
  return NextResponse.json({ id, status: body.status });
}
