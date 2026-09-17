import { NextRequest, NextResponse } from "next/server";
import { updateEnrollmentStatus, type EnrollmentStatus } from "@/lib/db-enrollments";
import { getClassServiceId } from "@/lib/db-classes";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: EnrollmentStatus[] = ["enrolled", "waitlisted", "withdrawn"];

// PATCH /api/classes/:id/enrollments/:enrollmentId — status change only
// (withdraw, or move off a waitlist). No hard delete: withdrawing keeps
// the roster's history intact, same "cancel, don't erase" pattern as
// every other status-driven entity in this app (a class itself is
// cancelled, never deleted; a task/lead/request is closed out, not
// removed).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; enrollmentId: string }> }) {
  const { id, enrollmentId } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as EnrollmentStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getClassServiceId(ctx.orgId, id);
  if (!serviceId) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to manage this class's roster" }, { status: 403 });
  }

  await updateEnrollmentStatus(ctx.orgId, enrollmentId, body.status as EnrollmentStatus);
  return NextResponse.json({ id: enrollmentId, status: body.status });
}
