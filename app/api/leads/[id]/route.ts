import { NextRequest, NextResponse } from "next/server";
import { getLeadServiceId, updateLeadStage, type LeadStage } from "@/lib/db-leads";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STAGES: LeadStage[] = ["new", "contacted", "assessed", "admitted", "lost"];

// PATCH /api/leads/:id — advance (or drop) a lead's stage. Same gate as
// tasks: that lead's service's Service Owner/Contributor or an Org
// Admin only — see app/api/tasks/[id]/route.ts for the identical
// reasoning.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.stage !== "string" || !VALID_STAGES.includes(body.stage as LeadStage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getLeadServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this lead" }, { status: 403 });
  }

  await updateLeadStage(ctx.orgId, id, body.stage as LeadStage);
  return NextResponse.json({ id, stage: body.stage });
}
