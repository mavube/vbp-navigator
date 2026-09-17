import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/db-tasks";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/tasks?serviceId=...&classId=...&serviceRequestId=... — all
// tasks for the caller's org, optionally filtered to one service, one
// class (its setup checklist), or one service request (v3.0 Phase 9 —
// lets RequestItem.tsx check whether a task has already been spawned
// from a given request).
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const classId = req.nextUrl.searchParams.get("classId") ?? undefined;
  const serviceRequestId = req.nextUrl.searchParams.get("serviceRequestId") ?? undefined;
  const tasks = await listTasks(orgId, serviceId, classId, serviceRequestId);
  return NextResponse.json(tasks);
}

// POST /api/tasks — create a task. Any signed-in org member can log a
// task against any service in their org (this matches how a real team
// actually works — see lib/permissions.ts's file comment); it's
// *updating* a task that's restricted to that service's owner/
// contributor or the assignee, enforced in app/api/tasks/[id]/route.ts.
//
// v3.0 Phase 9 additions: `serviceRequestId` (spawning a task from a
// Service Request — the one link that closes Cluster B's "Service
// Requests are completely isolated" gap) and `dependencies` (other task
// ids that must be `done` before this one can advance — captured since
// Phase 2 but never actually accepted from the client until now; see
// lib/db-tasks.ts's TaskRow comment). Both are trusted ids from the
// client, same trust level as `serviceId` above — the same-org
// constraint that actually matters is enforced when they're read back
// (getTask/getTasksByIds are org-scoped), not here.
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const dependencies = Array.isArray(body.dependencies)
    ? body.dependencies.filter((d: unknown): d is string => typeof d === "string" && d.length > 0).slice(0, 20)
    : undefined;

  const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];
  const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : undefined;

  const task = await createTask(orgId, {
    serviceId: body.serviceId,
    serviceRequestId: typeof body.serviceRequestId === "string" ? body.serviceRequestId : null,
    title: body.title.trim().slice(0, 200),
    description: typeof body.description === "string" ? body.description.slice(0, 4000) : undefined,
    priority,
    assigneeId: typeof body.assigneeId === "string" ? body.assigneeId : null,
    assigneeName: typeof body.assigneeName === "string" ? body.assigneeName.trim().slice(0, 200) : undefined,
    startDate: typeof body.startDate === "string" && body.startDate ? body.startDate : null,
    dueDate: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null,
    dependencies,
  });
  return NextResponse.json(task, { status: 201 });
}
