import { NextRequest, NextResponse } from "next/server";
import { getTaskServiceId, updateTaskStatus, type TaskStatus } from "@/lib/db-tasks";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: TaskStatus[] = ["open", "in_progress", "done"];

// PATCH /api/tasks/:id — update a task's status. Restricted to that
// task's service's Service Owner/Contributor, an Org Admin, or (see
// lib/permissions.ts) the assignee once assignee-level checks are
// worth adding — for now, ownership of the service is the gate, matching
// the RLS policy in supabase/migrations/0003_phase2_tasks.sql.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as TaskStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getTaskServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this task" }, { status: 403 });
  }

  await updateTaskStatus(ctx.orgId, id, body.status as TaskStatus);
  return NextResponse.json({ id, status: body.status });
}
