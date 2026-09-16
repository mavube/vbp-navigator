import { NextRequest, NextResponse } from "next/server";
import { getTaskServiceId, updateTaskStatus, updateTaskDates, type TaskStatus } from "@/lib/db-tasks";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: TaskStatus[] = ["open", "in_progress", "done"];

// PATCH /api/tasks/:id — update a task's status and/or its start/due
// dates (the latter added in v3.0 Phase 6 for the Gantt/Calendar
// views). Same gate for both: that task's service's Service Owner/
// Contributor or an Org Admin, matching the RLS policy in
// supabase/migrations/0003_phase2_tasks.sql.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const hasStatus = typeof body.status === "string";
  const hasStartDate = "startDate" in body;
  const hasDueDate = "dueDate" in body;

  if (hasStatus && !VALID_STATUSES.includes(body.status as TaskStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!hasStatus && !hasStartDate && !hasDueDate) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getTaskServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this task" }, { status: 403 });
  }

  if (hasStatus) {
    await updateTaskStatus(ctx.orgId, id, body.status as TaskStatus);
  }
  if (hasStartDate || hasDueDate) {
    await updateTaskDates(ctx.orgId, id, {
      startDate: hasStartDate ? (typeof body.startDate === "string" && body.startDate ? body.startDate : null) : undefined,
      dueDate: hasDueDate ? (typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null) : undefined,
    });
  }

  return NextResponse.json({
    id,
    ...(hasStatus ? { status: body.status } : {}),
    ...(hasStartDate ? { startDate: body.startDate || null } : {}),
    ...(hasDueDate ? { dueDate: body.dueDate || null } : {}),
  });
}
