import { NextRequest, NextResponse } from "next/server";
import { upsertFinding } from "@/lib/db";
import { FINDINGS } from "@/lib/findings-data";
import { getCurrentOrgId } from "@/lib/current-org";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["open", "confirmed", "resolved"]);
const VALID_IDS = new Set(FINDINGS.map((f) => f.id));

// PATCH /api/findings/:id — update status and/or note for one finding,
// scoped to the caller's org. Last-writer-wins, same semantics as the
// original Artifact's shared db.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!VALID_IDS.has(id)) {
    return NextResponse.json({ error: "Unknown finding id" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: { status?: string; note?: string } = {};

  if (typeof body.status === "string") {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.note === "string") {
    patch.note = body.note.slice(0, 4000);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const orgId = await getCurrentOrgId();
  const updated = await upsertFinding(orgId, id, patch);
  return NextResponse.json(updated);
}
