import { NextRequest, NextResponse } from "next/server";
import { listEnrollments, enrollCustomer } from "@/lib/db-enrollments";
import { getClassServiceId } from "@/lib/db-classes";
import { getUserContext, canManageService } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/classes/:id/enrollments — this class's roster, oldest first.
// Same org-wide read visibility as everything else.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  const enrollments = await listEnrollments(ctx.orgId, id);
  return NextResponse.json(enrollments);
}

// POST /api/classes/:id/enrollments — enroll a Customer. Gated the same
// as every other write against a class (that service's owner/
// contributor or an org admin), not open-creation — enrollment is a
// real roster record, not a to-do item anyone can add.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.customerId !== "string" || !body.customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getClassServiceId(ctx.orgId, id);
  if (!serviceId) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to manage this class's roster" }, { status: 403 });
  }

  try {
    const enrollment = await enrollCustomer(ctx.orgId, id, body.customerId);
    return NextResponse.json(enrollment, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't enroll customer" }, { status: 400 });
  }
}
