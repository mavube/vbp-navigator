// Data layer for the `comments` table — schema in
// supabase/migrations/0009_phase6_collaboration.sql. Polymorphic:
// entityType is a free-text label ("task", "lead", "class",
// "budget_request", "service_request", ...) rather than a fixed enum,
// so a new module can start hosting a comment thread without a schema
// change — it just needs to pass a consistent string. See that
// migration's comment for why entity_id isn't a real foreign key.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface CommentRow {
  id: string;
  entityType: string;
  entityId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
}

export interface NewComment {
  entityType: string;
  entityId: string;
  authorId?: string | null;
  authorName: string;
  body: string;
  mentions?: string[];
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        author_id TEXT,
        author_name TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        mentions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): CommentRow {
  return {
    id: row.id as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    authorId: (row.author_id as string) ?? null,
    authorName: row.author_name as string,
    body: row.body as string,
    mentions: JSON.parse((row.mentions as string) || "[]"),
    createdAt: row.created_at as string,
  };
}

export async function listComments(orgId: string, entityType: string, entityId: string): Promise<CommentRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, entity_type AS "entityType", entity_id AS "entityId", author_id AS "authorId",
              author_name AS "authorName", body, mentions, created_at AS "createdAt"
       FROM comments WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at ASC`,
      [orgId, entityType, entityId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM comments WHERE org_id = ? AND entity_type = ? AND entity_id = ? ORDER BY created_at ASC`)
    .all(orgId, entityType, entityId) as Record<string, unknown>[];
  return rows.map(fromSqliteRow);
}

export async function createComment(orgId: string, input: NewComment): Promise<CommentRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const authorId = input.authorId ?? null;
  const mentions = input.mentions ?? [];

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO comments (id, org_id, entity_type, entity_id, author_id, author_name, body, mentions, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, orgId, input.entityType, input.entityId, authorId, input.authorName, input.body, mentions, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO comments (id, org_id, entity_type, entity_id, author_id, author_name, body, mentions, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.entityType, input.entityId, authorId, input.authorName, input.body, JSON.stringify(mentions), now);
  }

  return {
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    authorId,
    authorName: input.authorName,
    body: input.body,
    mentions,
    createdAt: now,
  };
}
