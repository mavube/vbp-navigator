import { NextRequest, NextResponse } from "next/server";
import { listBlockers, createBlocker, type BlockerImpact } from "@/lib/db-blockers";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

const VALID_IMPACTS: BlockerImpact[] = ["low", "medium", "high", "critical"];

// GET /api/blockers?serviceId=... — all blockers for the caller's org,
// optionally filtered to one service.
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const blockers = await listBlockers(orgId, serviceId);
  return NextResponse.json(blockers);
}

// POST /api/blockers — report a blocker. Open to any org member, same
// as creating a Task or Service Request — whoever hit the blocker
// should be able to log it without needing to own the service it's
// against. Resolving it is a different, more restricted action (see
// app/api/blockers/[id]/route.ts).
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const impact = typeof body.impact === "string" && VALID_IMPACTS.includes(body.impact as BlockerImpact) ? (body.impact as BlockerImpact) : "medium";

  const blocker = await createBlocker(orgId, {
    serviceId: body.serviceId,
    taskId: typeof body.taskId === "string" && body.taskId ? body.taskId : null,
    title: body.title.trim().slice(0, 200),
    description: typeof body.description === "string" ? body.description.slice(0, 4000) : undefined,
    ownerName: typeof body.ownerName === "string" ? body.ownerName.trim().slice(0, 200) : undefined,
    impact,
    requiredAction: typeof body.requiredAction === "string" ? body.requiredAction.slice(0, 2000) : undefined,
  });
  return NextResponse.json(blocker, { status: 201 });
}
