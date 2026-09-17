import { NextRequest, NextResponse } from "next/server";
import { getTask, getTasksByIds, updateTaskStatus, updateTaskDates, type TaskStatus } from "@/lib/db-tasks";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: TaskStatus[] = ["open", "in_progress", "done"];

// PATCH /api/tasks/:id — update a task's status and/or its start/due
// dates (the latter added in v3.0 Phase 6 for the Gantt/Calendar
// views). Same gate for both: that task's service's Service Owner/
// Contributor or an Org Admin, matching the RLS policy in
// supabase/migrations/0003_phase2_tasks.sql.
//
// v3.0 Phase 9 (Cluster B) enforcement: `dependencies` has been on the
// schema since Phase 2 and rendered nowhere and enforced nowhere (see
// lib/db-tasks.ts's TaskRow comment) — closing that means a task that
// lists other tasks as dependencies can't move to in_progress or done
// while any of them isn't done yet. Moving *to* "open" is never
// blocked (that's always a safe, backward step); done-ness only
// matters going forward.
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
  const task = await getTask(ctx.orgId, id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!canManageService(ctx, task.serviceId)) {
    return NextResponse.json({ error: "Not allowed to update this task" }, { status: 403 });
  }

  if (hasStatus && (body.status === "in_progress" || body.status === "done") && task.dependencies.length > 0) {
    const deps = await getTasksByIds(ctx.orgId, task.dependencies);
    const unmet = deps.filter((d) => d.status !== "done");
    if (unmet.length > 0) {
      return NextResponse.json(
        {
          error: `Blocked by ${unmet.length} unfinished ${unmet.length === 1 ? "dependency" : "dependencies"}: ${unmet
            .map((d) => d.title)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }
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
