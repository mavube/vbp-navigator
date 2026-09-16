import { NextRequest, NextResponse } from "next/server";
import { listComments, createComment } from "@/lib/db-comments";
import { getUserContext, resolveDisplayName } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/comments?entityType=task&entityId=... — a comment thread for
// one entity, oldest first. entityType is free-text on purpose — see
// lib/db-comments.ts's file comment.
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  const entityType = req.nextUrl.searchParams.get("entityType");
  const entityId = req.nextUrl.searchParams.get("entityId");
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }
  const comments = await listComments(ctx.orgId, entityType, entityId);
  return NextResponse.json(comments);
}

// POST /api/comments — post a comment. Open to anyone in the org, same
// as the entities it attaches to (Tasks, Leads, Classes, ...) — see
// migration 0009's comment for why there's no permission gate here.
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  const body = await req.json().catch(() => ({}));

  if (typeof body.entityType !== "string" || !body.entityType) {
    return NextResponse.json({ error: "entityType is required" }, { status: 400 });
  }
  if (typeof body.entityId !== "string" || !body.entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const mentions = Array.isArray(body.mentions)
    ? body.mentions.filter((m: unknown): m is string => typeof m === "string").map((m: string) => m.trim().slice(0, 100)).filter(Boolean)
    : [];

  const authorName = await resolveDisplayName(ctx, body.authorName);
  const comment = await createComment(ctx.orgId, {
    entityType: body.entityType,
    entityId: body.entityId,
    authorId: ctx.userId,
    authorName,
    body: body.body.trim().slice(0, 4000),
    mentions,
  });
  return NextResponse.json(comment, { status: 201 });
}
