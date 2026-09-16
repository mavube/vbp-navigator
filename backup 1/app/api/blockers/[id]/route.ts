import { NextRequest, NextResponse } from "next/server";
import { getBlockerServiceId, resolveBlocker } from "@/lib/db-blockers";
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
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action !== "resolve") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const ctx = await getUserContext();
  const serviceId = await getBlockerServiceId(ctx.orgId, id);
  if (!serviceId) {
    return NextResponse.json({ error: "Blocker not found" }, { status: 404 });
  }
  if (!canManageService(ctx, serviceId)) {
    return NextResponse.json({ error: "Not allowed to resolve this blocker" }, { status: 403 });
  }

  await resolveBlocker(ctx.orgId, id);
  return NextResponse.json({ id, status: "resolved" });
}
