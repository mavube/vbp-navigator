import { NextRequest, NextResponse } from "next/server";
import { listServiceRequests, createServiceRequest, type RequestType, type RequestPriority } from "@/lib/db-service-requests";
import { getUserContext, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TYPES: RequestType[] = ["request", "incident"];
const VALID_PRIORITIES: RequestPriority[] = ["low", "medium", "high", "urgent"];

// GET /api/service-requests?serviceId=... — all requests/incidents for
// the caller's org, optionally filtered to one service.
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const requests = await listServiceRequests(ctx.orgId, serviceId);
  return NextResponse.json(requests);
}

// POST /api/service-requests — submit a request or report an incident.
// Open to anyone in the org, same as Tasks/Leads/Classes/Budget
// Requests — Requester is the default role for any staff member (see
// alignment doc Section 4). Managing status is a separate, gated PATCH.
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const type = VALID_TYPES.includes(body.type) ? (body.type as RequestType) : "request";
  const priority = VALID_PRIORITIES.includes(body.priority) ? (body.priority as RequestPriority) : "medium";

  const requesterName = await resolveDisplayName(ctx, body.requesterName);
  const request = await createServiceRequest(ctx.orgId, {
    serviceId: body.serviceId,
    requesterId: ctx.userId,
    requesterName,
    type,
    priority,
    title: body.title.trim().slice(0, 200),
    description: typeof body.description === "string" ? body.description.slice(0, 4000) : undefined,
  });
  return NextResponse.json(request, { status: 201 });
}
