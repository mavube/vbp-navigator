import { NextRequest, NextResponse } from "next/server";
import { getClassServiceId, updateClassStatus, type ClassStatus } from "@/lib/db-classes";
import { listTasks } from "@/lib/db-tasks";
import { createInvoice } from "@/lib/db-invoices";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ClassStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

// PATCH /api/classes/:id — update a class's status. Same gate as tasks
// and leads: that class's service's Service Owner/Contributor or an
// Org Admin only — see app/api/tasks/[id]/route.ts for the identical
// reasoning.
//
// v3.0 roadmap Phase 9 (Cluster B) closes two dead ends the audit
// named, both scoped to the transition into "completed" specifically:
//
// 1. Gating — a class could be marked completed with its auto-
//    generated setup checklist still open. Now rejected server-side
//    (ClassItem.tsx already showed the checklist and let staff tick it
//    off; this just makes the rule real rather than advisory-only).
//    Any task tagged to the class counts, not only the five standard
//    setup tasks, since a class could have extra tasks manually tied to
//    it too.
// 2. Invoice — `invoices.class_id` has existed since Phase 5
//    specifically for this (per that migration's own comment) and was
//    never used. Rather than inventing an amount (this app never
//    fabricates a financial figure — see lib/payroll.ts's illustrative-
//    rates disclaimer for the same discipline applied elsewhere), the
//    invoice is opt-in and staff-entered: pass `invoice: { party,
//    amount, dueDate? }` alongside `status: "completed"` and an
//    outgoing invoice is created against the class in the same request.
//    Leaving `invoice` out completes the class with no invoice, exactly
//    like today — nothing about existing classes' behavior changes
//    unless the caller opts in.
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

  if (body.status === "completed") {
    const classTasks = await listTasks(ctx.orgId, undefined, id);
    const openCount = classTasks.filter((t) => t.status !== "done").length;
    if (openCount > 0) {
      return NextResponse.json(
        { error: `Complete the setup checklist first — ${openCount} task${openCount === 1 ? "" : "s"} still open.` },
        { status: 400 }
      );
    }
  }

  await updateClassStatus(ctx.orgId, id, body.status as ClassStatus);

  let invoice = null;
  if (body.status === "completed" && body.invoice && typeof body.invoice === "object") {
    const party = typeof body.invoice.party === "string" ? body.invoice.party.trim().slice(0, 200) : "";
    const amount = Number(body.invoice.amount);
    if (party && Number.isFinite(amount) && amount >= 0) {
      invoice = await createInvoice(ctx.orgId, {
        serviceId,
        classId: id,
        direction: "outgoing",
        party,
        amount,
        dueDate: typeof body.invoice.dueDate === "string" && body.invoice.dueDate ? body.invoice.dueDate : null,
      });
    }
  }

  return NextResponse.json({ id, status: body.status, invoice });
}
