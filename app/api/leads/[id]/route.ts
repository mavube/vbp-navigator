import { NextRequest, NextResponse } from "next/server";
import { getLeadServiceId, updateLeadStage, type LeadStage } from "@/lib/db-leads";
import { admitLead } from "@/lib/db-engagements";
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

  // v3.0 roadmap Phase 4: "admitted" is the one stage that converts a
  // lead into a real Customer + Engagement (see lib/db-engagements.ts's
  // admitLead) — the confirmed decision's "prospect converts into a
  // full customer record on admission" behavior, hung off Leads'
  // existing pipeline rather than a new one. Best-effort: a failure
  // here shouldn't roll back or block the stage change itself, since
  // the lead update already succeeded and is the more important write.
  let customerId: string | null = null;
  let engagementId: string | null = null;
  if (body.stage === "admitted") {
    try {
      const result = await admitLead(ctx.orgId, id);
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
