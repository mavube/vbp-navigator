import { NextRequest, NextResponse } from "next/server";
import { listMemory, createMemoryEntry, type MemoryType } from "@/lib/db-org-memory";
import { getUserContext, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TYPES: MemoryType[] = ["decision", "lesson"];

// GET /api/memory — every decision/lesson entry for the org, newest
// first. v3.0 roadmap Phase 9 (§17, built here as Phase 13). Same
// org-wide visibility as Comments — no permission gate beyond being in
// the org, see migration 0019's comment.
export async function GET() {
  const ctx = await getUserContext();
  const entries = await listMemory(ctx.orgId);
  return NextResponse.json(entries);
}

// POST /api/memory — add a decision/lesson entry. Open to anyone in
// the org, same as posting a Comment — this is a log, not a controlled
// record like an Expense or Budget Request.
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  const type = typeof body.type === "string" && VALID_TYPES.includes(body.type as MemoryType) ? (body.type as MemoryType) : "lesson";
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null;
  const entryBody = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";

  const authorName = await resolveDisplayName(ctx, body.authorName);
  const entry = await createMemoryEntry(ctx.orgId, {
    type,
    title: body.title.trim().slice(0, 300),
    body: entryBody,
    serviceId,
    authorId: ctx.userId,
    authorName,
  });
  return NextResponse.json(entry, { status: 201 });
}
