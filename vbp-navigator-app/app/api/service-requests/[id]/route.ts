import { NextRequest, NextResponse } from "next/server";
import { getServiceRequestServiceId, updateServiceRequestStatus, type RequestStatus } from "@/lib/db-service-requests";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: RequestStatus[] = ["open", "in_progress", "resolved", "closed"];

// PATCH /api/service-requests/:id — move a request through status.
// Same gate as Tasks/Leads/Classes: that service's Service
// Owner/Contributor or an Org Admin only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as RequestStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getServiceRequestServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Service request not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this request" }, { status: 403 });
  }

  await updateServiceRequestStatus(ctx.orgId, id, body.status as RequestStatus);
  return NextResponse.json({ id, status: body.status });
}
