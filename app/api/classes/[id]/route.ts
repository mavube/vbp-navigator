import { NextRequest, NextResponse } from "next/server";
import { getClassServiceId, updateClassStatus, type ClassStatus } from "@/lib/db-classes";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ClassStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

// PATCH /api/classes/:id — update a class's status. Same gate as tasks
// and leads: that class's service's Service Owner/Contributor or an
// Org Admin only — see app/api/tasks/[id]/route.ts for the identical
// reasoning.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as ClassStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getClassServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this class" }, { status: 403 });
  }

  await updateClassStatus(ctx.orgId, id, body.status as ClassStatus);
  return NextResponse.json({ id, status: body.status });
}
