// Data layer for the `blockers` table — schema in
// supabase/migrations/0014_phase6_work_views_blockers.sql. v3.0 roadmap
// §11: blockers as first-class, traceable objects (owner, impact,
// required action), not just something inferred from a task sitting in
// "open" too long. Same dual-driver / org-filtering pattern as every
// other lib/db-*.ts module — see lib/db-driver.ts.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type BlockerImpact = "low" | "medium" | "high" | "critical";
export type BlockerStatus = "open" | "resolved";

export interface BlockerRow {
  id: string;
  serviceId: string;
  taskId: string | null;
  title: string;
  description: string;
  ownerName: string;
  impact: BlockerImpact;
  requiredAction: string;
  status: BlockerStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface NewBlocker {
  serviceId: string;
  taskId?: string | null;
  title: string;
  description?: string;
  ownerName?: string;
  impact?: BlockerImpact;
  requiredAction?: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS blockers (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        task_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        owner_name TEXT NOT NULL DEFAULT '',
        impact TEXT NOT NULL DEFAULT 'medium',
        required_action TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): BlockerRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    taskId: (row.task_id as string) ?? null,
    title: row.title as string,
    description: row.description as string,
    ownerName: row.owner_name as string,
    impact: row.impact as BlockerImpact,
    requiredAction: row.required_action as string,
    status: row.status as BlockerStatus,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
  };
}

export async function listBlockers(orgId: string, serviceId?: string): Promise<BlockerRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", task_id AS "taskId", title, description,
                  owner_name AS "ownerName", impact, required_action AS "requiredAction", status,
                  created_at AS "createdAt", resolved_at AS "resolvedAt"`;
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM blockers WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(`SELECT ${cols} FROM blockers WHERE org_id = $1 ORDER BY created_at DESC`, [orgId]);
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM blockers WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM blockers WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createBlocker(orgId: string, input: NewBlocker): Promise<BlockerRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const taskId = input.taskId ?? null;
  const description = input.description ?? "";
  const ownerName = input.ownerName ?? "";
  const impact = input.impact ?? "medium";
  const requiredAction = input.requiredAction ?? "";

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO blockers (id, org_id, service_id, task_id, title, description, owner_name, impact, required_action, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10)`,
      [id, orgId, input.serviceId, taskId, input.title, description, ownerName, impact, requiredAction, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO blockers (id, org_id, service_id, task_id, title, description, owner_name, impact, required_action, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,'open',?)`
      )
      .run(id, orgId, input.serviceId, taskId, input.title, description, ownerName, impact, requiredAction, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    taskId,
    title: input.title,
    description,
    ownerName,
    impact,
    requiredAction,
    status: "open",
    createdAt: now,
    resolvedAt: null,
  };
}

export async function getBlockerServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT service_id AS "serviceId" FROM blockers WHERE org_id = $1 AND id = $2`, [
      orgId,
      id,
    ]);
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT service_id FROM blockers WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | { service_id: string }
    | undefined;
  return row?.service_id ?? null;
}

export async function resolveBlocker(orgId: string, id: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(`UPDATE blockers SET status = 'resolved', resolved_at = $1 WHERE org_id = $2 AND id = $3`, [
      now,
      orgId,
      id,
    ]);
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE blockers SET status = 'resolved', resolved_at = ? WHERE org_id = ? AND id = ?`)
      .run(now, orgId, id);
  }
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly, same pattern as every other module's ensure*Schema export.
export function ensureBlockersSchema(): Promise<void> {
  return ensureSchema();
}
