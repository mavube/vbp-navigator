import { NextRequest, NextResponse } from "next/server";
import { listClasses, createClass } from "@/lib/db-classes";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

// GET /api/classes?serviceId=... — all classes for the caller's org,
// optionally filtered to one service (typically Master Class Delivery).
export async function GET(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const serviceId = req.nextUrl.searchParams.get("serviceId") ?? undefined;
  const classes = await listClasses(orgId, serviceId);
  return NextResponse.json(classes);
}

// POST /api/classes — schedule a new class. Same open-creation rule as
// tasks and leads (see app/api/tasks/route.ts) — anyone can schedule
// one; only that service's owner/contributor can advance its status.
// Creating a class also generates its standard setup Task[] — see
// lib/db-classes.ts's createClass.
export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));

  if (typeof body.serviceId !== "string" || !body.serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const cls = await createClass(orgId, {
    serviceId: body.serviceId,
    title: body.title.trim().slice(0, 200),
    scheduledDate: typeof body.scheduledDate === "string" ? body.scheduledDate : null,
    instructorName: typeof body.instructorName === "string" ? body.instructorName.slice(0, 200) : undefined,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : undefined,
  });
  return NextResponse.json(cls, { status: 201 });
}
