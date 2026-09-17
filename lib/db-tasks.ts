// Data layer for the `tasks` table — schema in
// supabase/migrations/0003_phase2_tasks.sql. Same org-filtering pattern
// as lib/db.ts (see lib/db-driver.ts for why); permission checks (who
// may create/update) live in lib/permissions.ts and the API routes, not
// here — this module just reads and writes rows for an org already
// known to be the caller's.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type TaskStatus = "open" | "in_progress" | "done";
// v3.0 roadmap Phase 11 (Cluster D) — "no priority field on Task at
// all (so no color coding by urgency)." Four values, ordered low to
// urgent; 'normal' is the default so every task created before this
// field existed reads as unremarkable rather than silently becoming
// "low" or "urgent."
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface TaskRow {
  id: string;
  serviceId: string;
  classId: string | null;
  // v3.0 roadmap Phase 9 (Cluster B — Workflow wiring) — the link that
  // lets a Task trace back to the Service Request it was spawned from
  // (see app/api/service-requests/[id]/spawn-task or, more precisely,
  // the "create task" action on RequestItem.tsx). Nullable, same shape
  // as classId above.
  serviceRequestId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string;
  startDate: string | null;
  dueDate: string | null;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  serviceId: string;
  classId?: string | null;
  serviceRequestId?: string | null;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string;
  startDate?: string | null;
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
        start_date TEXT,
        due_date TEXT,
        dependencies TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      // class_id (Phase 4), assignee_name (Phase 7), start_date (Phase 6
      // of v3.0), and service_request_id (Phase 9 of v3.0) were all
      // added after this table first shipped — existing local dev.db
      // files predate them, so add each defensively rather than
      // requiring a fresh dev.db (mirrors the Postgres migrations'
      // `add column if not exists`).
      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "class_id")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN class_id TEXT`);
      }
      if (!cols.some((c) => c.name === "assignee_name")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN assignee_name TEXT NOT NULL DEFAULT ''`);
      }
      if (!cols.some((c) => c.name === "start_date")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN start_date TEXT`);
      }
      if (!cols.some((c) => c.name === "service_request_id")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN service_request_id TEXT`);
      }
      if (!cols.some((c) => c.name === "priority")) {
        db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`);
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
    serviceRequestId: (row.service_request_id as string) ?? null,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    priority: ((row.priority as string) || "normal") as TaskPriority,
    assigneeId: (row.assignee_id as string) ?? null,
    assigneeName: (row.assignee_name as string) ?? "",
    startDate: (row.start_date as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    dependencies: JSON.parse((row.dependencies as string) || "[]"),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// serviceRequestId filter added in v3.0 Phase 9 — lets RequestItem.tsx
// ask "has a task already been spawned from this request?" without a
// new endpoint. Kept as a fourth optional filter rather than a generic
// query-object param, matching this function's existing shape.
export async function listTasks(
  orgId: string,
  serviceId?: string,
  classId?: string,
  serviceRequestId?: string
): Promise<TaskRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", class_id AS "classId", service_request_id AS "serviceRequestId",
                  title, description, status, priority,
                  assignee_id AS "assigneeId", assignee_name AS "assigneeName",
                  start_date AS "startDate", due_date AS "dueDate", dependencies,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = serviceRequestId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM tasks WHERE org_id = $1 AND service_request_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceRequestId]
        )
      : classId
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
  const rows = serviceRequestId
    ? db.prepare(`SELECT * FROM tasks WHERE org_id = ? AND service_request_id = ? ORDER BY created_at DESC`).all(orgId, serviceRequestId)
    : classId
      ? db.prepare(`SELECT * FROM tasks WHERE org_id = ? AND class_id = ? ORDER BY created_at DESC`).all(orgId, classId)
      : serviceId
        ? db.prepare(`SELECT * FROM tasks WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
        : db.prepare(`SELECT * FROM tasks WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Full rows for a known set of ids, org-scoped — v3.0 Phase 9 needs this
// twice: resolving a task's own `dependencies` list into real rows (to
// check they're all `done` before allowing it to advance) and, more
// generally, anywhere a small batch of tasks needs to be read by id
// rather than by service/class. Empty input short-circuits rather than
// generating a query with an empty IN (...) list, which errors on some
// drivers and is meaningless either way.
export async function getTasksByIds(orgId: string, ids: string[]): Promise<TaskRow[]> {
  if (ids.length === 0) return [];
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", class_id AS "classId", service_request_id AS "serviceRequestId",
                  title, description, status, priority,
                  assignee_id AS "assigneeId", assignee_name AS "assigneeName",
                  start_date AS "startDate", due_date AS "dueDate", dependencies,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${cols} FROM tasks WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, ids]
    );
    return res.rows;
  }
  const db = await getSqliteDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM tasks WHERE org_id = ? AND id IN (${placeholders})`).all(orgId, ...ids);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createTask(orgId: string, input: NewTask): Promise<TaskRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const description = input.description ?? "";
  const assigneeId = input.assigneeId ?? null;
  const assigneeName = input.assigneeName ?? "";
  const startDate = input.startDate ?? null;
  const dueDate = input.dueDate ?? null;
  const dependencies = input.dependencies ?? [];
  const classId = input.classId ?? null;
  const serviceRequestId = input.serviceRequestId ?? null;
  const priority = input.priority ?? "normal";

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO tasks (id, org_id, service_id, class_id, service_request_id, title, description, status, priority, assignee_id, assignee_name, start_date, due_date, dependencies, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,$10,$11,$12,$13,$14,$14)`,
      [id, orgId, input.serviceId, classId, serviceRequestId, input.title, description, priority, assigneeId, assigneeName, startDate, dueDate, dependencies, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO tasks (id, org_id, service_id, class_id, service_request_id, title, description, status, priority, assignee_id, assignee_name, start_date, due_date, dependencies, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'open',?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, classId, serviceRequestId, input.title, description, priority, assigneeId, assigneeName, startDate, dueDate, JSON.stringify(dependencies), now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    classId,
    serviceRequestId,
    title: input.title,
    description,
    status: "open",
    priority,
    assigneeId,
    assigneeName,
    startDate,
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

// Full row by id — v3.0 Phase 9 needs a task's own `status` (to decide
// whether resolving its last blocker should advance it) and its
// `dependencies` (to enforce them on a status change), neither of which
// the existing service-id-only getter carries.
export async function getTask(orgId: string, id: string): Promise<TaskRow | null> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", class_id AS "classId", service_request_id AS "serviceRequestId",
                  title, description, status, priority,
                  assignee_id AS "assigneeId", assignee_name AS "assigneeName",
                  start_date AS "startDate", due_date AS "dueDate", dependencies,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${cols} FROM tasks WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM tasks WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
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

// v3.0 roadmap Phase 11 (Cluster D) — the Kanban board's priority
// color-coding needs a way to change a task's priority after creation,
// not just at creation time (a task made before this phase, or made
// without thinking about it yet, still needs an editing path). Same
// gate as updateTaskStatus (that service's owner/contributor or an org
// admin), enforced in the route handler, not here.
export async function updateTaskPriority(orgId: string, id: string, priority: TaskPriority): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE tasks SET priority = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [priority, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE tasks SET priority = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(priority, now, orgId, id);
  }
}

// Phase 6 of v3.0 — Gantt/Calendar need a way to set/edit a task's
// dates after creation, not just at creation time (NewTaskForm already
// collects them, but a task made before this phase — or made without
// dates — needs an editing path too). Separate from updateTaskStatus
// rather than folded into one "updateTask" with every field optional,
// since the two are gated by the same permission check but triggered
// from different UI (status buttons vs. a small date-edit form) and
// keeping them distinct keeps each call site simple about what it's
// asking for.
export async function updateTaskDates(
  orgId: string,
  id: string,
  dates: { startDate?: string | null; dueDate?: string | null }
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  const setStart = dates.startDate !== undefined;
  const setDue = dates.dueDate !== undefined;
  if (!setStart && !setDue) return;

  if (IS_POSTGRES) {
    const pool = await getPgPool();
    if (setStart && setDue) {
      await pool.query(
        `UPDATE tasks SET start_date = $1, due_date = $2, updated_at = $3 WHERE org_id = $4 AND id = $5`,
        [dates.startDate, dates.dueDate, now, orgId, id]
      );
    } else if (setStart) {
      await pool.query(`UPDATE tasks SET start_date = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`, [
        dates.startDate,
        now,
        orgId,
        id,
      ]);
    } else {
      await pool.query(`UPDATE tasks SET due_date = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`, [
        dates.dueDate,
        now,
        orgId,
        id,
      ]);
    }
    return;
  }

  const db = await getSqliteDb();
  if (setStart && setDue) {
    db.prepare(`UPDATE tasks SET start_date = ?, due_date = ?, updated_at = ? WHERE org_id = ? AND id = ?`).run(
      dates.startDate,
      dates.dueDate,
      now,
      orgId,
      id
    );
  } else if (setStart) {
    db.prepare(`UPDATE tasks SET start_date = ?, updated_at = ? WHERE org_id = ? AND id = ?`).run(dates.startDate, now, orgId, id);
  } else {
    db.prepare(`UPDATE tasks SET due_date = ?, updated_at = ? WHERE org_id = ? AND id = ?`).run(dates.dueDate, now, orgId, id);
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
