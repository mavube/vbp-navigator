import { NextRequest, NextResponse } from "next/server";
import { getEngagement, updateEngagementStatus, type EngagementStatus } from "@/lib/db-engagements";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: EngagementStatus[] = ["active", "completed", "paused"];

// PATCH /api/engagements/:id — Phase E (Customer Workspace rebuild):
// closes a real, pre-existing gap — lib/db-engagements.ts's
// updateEngagementStatus has existed since Phase 4 but no route ever
// called it, so an Engagement's status has been frozen at whatever
// convertLead set it to ('active') for every engagement in this app
// until now. Same gate as advancing a Lead's stage (that engagement's
// service's Owner/Contributor or an Org Admin) — see
// app/api/leads/[id]/route.ts for the identical reasoning.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as EngagementStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const outcomeNote = typeof body.outcomeNote === "string" ? body.outcomeNote.slice(0, 4000) : undefined;

  const ctx = await getUserContext();
  const engagement = await getEngagement(ctx.orgId, id);
  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }
  if (!canManageService(ctx, engagement.serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this engagement" }, { status: 403 });
  }

  await updateEngagementStatus(ctx.orgId, id, body.status as EngagementStatus, outcomeNote);
  return NextResponse.json({ id, status: body.status, outcomeNote: outcomeNote ?? engagement.outcomeNote });
}
