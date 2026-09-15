// Data layer for the `tasks` table — schema in
// supabase/migrations/0003_phase2_tasks.sql. Same org-filtering pattern
// as lib/db.ts (see lib/db-driver.ts for why); permission checks (who
// may create/update) live in lib/permissions.ts and the API routes, not
// here — this module just reads and writes rows for an org already
// known to be the caller's.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type TaskStatus = "open" | "in_progress" | "done";

export interface TaskRow {
  id: string;
  serviceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueDate: string | null;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  serviceId: string;
  title: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  dependencies?: string[];
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        assignee_id TEXT,
        due_date TEXT,
        dependencies TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): TaskRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    assigneeId: (row.assignee_id as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    dependencies: JSON.parse((row.dependencies as string) || "[]"),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listTasks(orgId: string, serviceId?: string): Promise<TaskRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT id, service_id AS "serviceId", title, description, status,
                  assignee_id AS "assigneeId", due_date AS "dueDate", dependencies,
                  created_at AS "createdAt", updated_at AS "updatedAt"
           FROM tasks WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT id, service_id AS "serviceId", title, description, status,
                  assignee_id AS "assigneeId", due_date AS "dueDate", dependencies,
                  created_at AS "createdAt", updated_at AS "updatedAt"
           FROM tasks WHERE org_id = $1 ORDER BY created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM tasks WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM tasks WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createTask(orgId: string, input: NewTask): Promise<TaskRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const description = input.description ?? "";
  const assigneeId = input.assigneeId ?? null;
  const dueDate = input.dueDate ?? null;
  const dependencies = input.dependencies ?? [];

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO tasks (id, org_id, service_id, title, description, status, assignee_id, due_date, dependencies, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$9)`,
      [id, orgId, input.serviceId, input.title, description, assigneeId, dueDate, dependencies, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO tasks (id, org_id, service_id, title, description, status, assignee_id, due_date, dependencies, created_at, updated_at)
         VALUES (?,?,?,?,?,'open',?,?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, input.title, description, assigneeId, dueDate, JSON.stringify(dependencies), now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    title: input.title,
    description,
    status: "open",
    assigneeId,
    dueDate,
    dependencies,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getTaskServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT service_id AS "serviceId" FROM tasks WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT service_id FROM tasks WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | { service_id: string }
    | undefined;
  return row?.service_id ?? null;
}

export async function updateTaskStatus(orgId: string, id: string, status: TaskStatus): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE tasks SET status = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [status, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, now, orgId, id);
  }
}
