import { NextRequest, NextResponse } from "next/server";
import { promoteProspectToLead } from "@/lib/db-prospects";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// POST /api/prospects/:id/promote — turns a reviewed prospect into a
// real Lead in the existing Pipeline (lib/db-prospects.ts's
// promoteProspectToLead), starting it at Leads' own 'new' stage. Body
// must carry serviceId if the prospect didn't already pick one on
// /apply or /assess — staff choosing it during review either way.
// Same open-creation rule as logging a Lead directly (anyone in the
// org can do this).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }

  const orgId = await getCurrentOrgId();
  try {
    const { lead, duplicateWarning, task } = await promoteProspectToLead(orgId, id, body.serviceId);
    return NextResponse.json({ leadId: lead.id, duplicateWarning, taskId: task.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't promote prospect" }, { status: 400 });
  }
}
