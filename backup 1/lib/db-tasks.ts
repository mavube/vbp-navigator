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
  classId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string;
  dueDate: string | null;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  serviceId: string;
  classId?: string | null;
  title: string;
  description?: string;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: string | null;
  dependencies?: string[];
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        class_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        assignee_id TEXT,
        assignee_name TEXT NOT NULL DEFAULT '',
        due_date TEXT,
        dependencies TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      // class_id (Phase 4) and assignee_name (Phase 7) were added after
      // this table first shipped — existing local dev.db files predate
      // them, so add both defensively rather than requiring a fresh
      // dev.db (mirrors the Postgres migrations' `add column if not
      // exists`).
      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "class_id")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN class_id TEXT`);
      }
      if (!cols.some((c) => c.name === "assignee_name")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN assignee_name TEXT NOT NULL DEFAULT ''`);
      }
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): TaskRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    classId: (row.class_id as string) ?? null,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    assigneeId: (row.assignee_id as string) ?? null,
    assigneeName: (row.assignee_name as string) ?? "",
    dueDate: (row.due_date as string) ?? null,
    dependencies: JSON.parse((row.dependencies as string) || "[]"),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listTasks(orgId: string, serviceId?: string, classId?: string): Promise<TaskRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", class_id AS "classId", title, description, status,
                  assignee_id AS "assigneeId", assignee_name AS "assigneeName", due_date AS "dueDate", dependencies,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = classId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM tasks WHERE org_id = $1 AND class_id = $2 ORDER BY created_at DESC`,
          [orgId, classId]
        )
      : serviceId
        ? await (await getPgPool()).query(
            `SELECT ${cols} FROM tasks WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
            [orgId, serviceId]
          )
        : await (await getPgPool()).query(
            `SELECT ${cols} FROM tasks WHERE org_id = $1 ORDER BY created_at DESC`,
            [orgId]
          );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = classId
    ? db.prepare(`SELECT * FROM tasks WHERE org_id = ? AND class_id = ? ORDER BY created_at DESC`).all(orgId, classId)
    : serviceId
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
  const assigneeName = input.assigneeName ?? "";
  const dueDate = input.dueDate ?? null;
  const dependencies = input.dependencies ?? [];
  const classId = input.classId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO tasks (id, org_id, service_id, class_id, title, description, status, assignee_id, assignee_name, due_date, dependencies, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,$10,$11,$11)`,
      [id, orgId, input.serviceId, classId, input.title, description, assigneeId, assigneeName, dueDate, dependencies, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO tasks (id, org_id, service_id, class_id, title, description, status, assignee_id, assignee_name, due_date, dependencies, created_at, updated_at)
         VALUES (?,?,?,?,?,?,'open',?,?,?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, classId, input.title, description, assigneeId, assigneeName, dueDate, JSON.stringify(dependencies), now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    classId,
    title: input.title,
    description,
    status: "open",
    assigneeId,
    assigneeName,
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

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (ensureSchema() above is otherwise only ever called lazily,
// from this module's own read/write functions). No-op on Postgres, where
// the migrations own the schema.
export function ensureTasksSchema(): Promise<void> {
  return ensureSchema();
}
