import { NextRequest, NextResponse } from "next/server";
import { getBlocker, resolveBlocker, countOpenBlockersForTask } from "@/lib/db-blockers";
import { getTask, updateTaskStatus } from "@/lib/db-tasks";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/blockers/:id — resolve a blocker. Only that blocker's
// service's Service Owner/Contributor or an Org Admin can — the people
// actually positioned to unblock the work, not necessarily whoever
// reported it. The only supported action is "resolve" (no un-resolve,
// no edit-in-place — mirrors Documents' "closed is closed" pattern
// rather than Tasks' free status toggle, since a blocker's whole point
// is a record that it existed and got cleared, not a status you flip
// back and forth).
//
// v3.0 roadmap Phase 9 (Cluster B) — "resolving a Blocker doesn't touch
// its linked Task's status" was the audit's own wording for a real dead
// end. The narrow, deliberate rule that closes it without inventing a
// "blocked" task status that doesn't exist in the schema (Task status
// stays exactly open/in_progress/done, same three states as always —
// Blockers were introduced in Phase 6 specifically *instead of*
// inferring "blocked" from task status, see lib/db-blockers.ts's file
// comment, so this doesn't walk that back): if the blocker being
// resolved is linked to a task, AND it was the *last* open blocker on
// that task, AND the task is still sitting in "open" (never started —
// there's nothing to "unblock" if work is already under way or done),
// advance that task straight to "in_progress". Anything else about the
// task (who's assigned, its dates) is untouched; this is the one
// specific case the audit named, not a general auto-status-flip rule.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action !== "resolve") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const blocker = await getBlocker(ctx.orgId, id);
  if (!blocker) {
    return NextResponse.json({ error: "Blocker not found" }, { status: 404 });
  }
  if (!canManageService(ctx, blocker.serviceId)) {
    return NextResponse.json({ error: "Not allowed to resolve this blocker" }, { status: 403 });
  }
  if (blocker.status === "resolved") {
    return NextResponse.json({ id, status: "resolved" });
  }

  await resolveBlocker(ctx.orgId, id);

  let unblockedTaskId: string | null = null;
  let unblockedTaskStatus: "in_progress" | null = null;
  if (blocker.taskId) {
    const remaining = await countOpenBlockersForTask(ctx.orgId, blocker.taskId);
    if (remaining === 0) {
      const task = await getTask(ctx.orgId, blocker.taskId);
      if (task && task.status === "open") {
        await updateTaskStatus(ctx.orgId, blocker.taskId, "in_progress");
        unblockedTaskId = blocker.taskId;
        unblockedTaskStatus = "in_progress";
      }
    }
  }

  return NextResponse.json({ id, status: "resolved", unblockedTaskId, unblockedTaskStatus });
}
