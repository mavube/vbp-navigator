import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/db-tasks";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/tasks?serviceId=...&classId=... — all tasks for the caller's
// org, optionally filtered to one service or (e.g. for a class's setup
// checklist) one class.
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const classId = req.nextUrl.searchParams.get("classId") ?? undefined;
  const tasks = await listTasks(orgId, serviceId, classId);
  return NextResponse.json(tasks);
}

// POST /api/tasks — create a task. Any signed-in org member can log a
// task against any service in their org (this matches how a real team
// actually works — see lib/permissions.ts's file comment); it's
// *updating* a task that's restricted to that service's owner/
// contributor or the assignee, enforced in app/api/tasks/[id]/route.ts.
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const task = await createTask(orgId, {
    serviceId: body.serviceId,
    title: body.title.trim().slice(0, 200),
    description: typeof body.description === "string" ? body.description.slice(0, 4000) : undefined,
    assigneeId: typeof body.assigneeId === "string" ? body.assigneeId : null,
    assigneeName: typeof body.assigneeName === "string" ? body.assigneeName.trim().slice(0, 200) : undefined,
    startDate: typeof body.startDate === "string" && body.startDate ? body.startDate : null,
    dueDate: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null,
  });
  return NextResponse.json(task, { status: 201 });
}
