import { NextRequest, NextResponse } from "next/server";
import { getLeadServiceId, updateLeadStage, updateLeadProductServiceId, type LeadStage } from "@/lib/db-leads";
import { convertLead } from "@/lib/db-engagements";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STAGES: LeadStage[] = ["new", "contacted", "qualified", "won", "lost"];

// PATCH /api/leads/:id — advance (or drop) a lead's stage, and/or
// (Phase C) attach which catalog product it's for. Same gate as tasks:
// that lead's service's Service Owner/Contributor or an Org Admin only
// — see app/api/tasks/[id]/route.ts for the identical reasoning.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const hasStage = typeof body.stage === "string";
  const hasProduct = "productServiceId" in body;
  if (hasStage && !VALID_STAGES.includes(body.stage as LeadStage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (!hasStage && !hasProduct) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getLeadServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this lead" }, { status: 403 });
  }

  if (hasProduct) {
    const productServiceId = typeof body.productServiceId === "string" && body.productServiceId ? body.productServiceId : null;
    await updateLeadProductServiceId(ctx.orgId, id, productServiceId);
  }
  if (!hasStage) {
    return NextResponse.json({ id, productServiceId: body.productServiceId ?? null });
  }

  await updateLeadStage(ctx.orgId, id, body.stage as LeadStage);

  // v3.0 roadmap Phase 4: "won" (named "admitted" before Phase D's
  // generic-pipeline-vocabulary correction) is the one stage that
  // converts a lead into a real Customer + Engagement (see
  // lib/db-engagements.ts's convertLead) — the confirmed decision's
  // "prospect converts into a full customer record on admission"
  // behavior, hung off Leads' existing pipeline rather than a new one.
  // Best-effort: a failure here shouldn't roll back or block the stage
  // change itself, since the lead update already succeeded and is the
  // more important write.
  let customerId: string | null = null;
  let engagementId: string | null = null;
  if (body.stage === "won") {
    try {
      const result = await convertLead(ctx.orgId, id);
      if (result) {
        customerId = result.customer.id;
        engagementId = result.engagement.id;
      }
    } catch {
      // Logged nowhere special — this app has no error-tracking
      // integration yet. The lead's own stage change already
      // succeeded; the admin can still find/link the customer manually
      // from /customers if this ever actually fails.
    }
  }

  return NextResponse.json({ id, stage: body.stage, customerId, engagementId });
}
