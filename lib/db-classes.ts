// Data layer for the `classes` table — schema in
// supabase/migrations/0005_phase4_classes.sql. Same pattern as
// lib/db-tasks.ts and lib/db-leads.ts (org-filtering / RLS notes not
// repeated here) — the one thing this module does beyond a plain CRUD
// table is generate a standard checklist of Tasks when a class is
// created (createClass calls into lib/db-tasks.ts's createTask).
//
// Design note: every generated setup task is tagged to the *class's
// own* serviceId, not fanned out across other services (e.g. a venue
// task tagged to Operational Support, a materials task tagged to
// Digital & Information Enablement). That cross-service fan-out is
// what the earlier v1.0 prototype did with hardcoded departments, but
// re-pointing that at specific service IDs would break for any future
// tenant whose catalog doesn't have those exact services — the same
// reasoning that kept Pipeline (Phase 3) from auto-transitioning a
// lead's service. Tagging every setup task to the class's own service
// keeps the checklist idea without hardcoding cross-service structure.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { createTask } from "@/lib/db-tasks";

export type ClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface ClassRow {
  id: string;
  serviceId: string;
  // Phase C (portfolio correction) — which catalog product this class
  // instance is actually delivering (e.g. "PMP Master Class", "MS
  // Project Training"), if one was picked. Separate from serviceId —
  // see lib/db-leads.ts's LeadRow for the same field's reasoning.
  productServiceId: string | null;
  title: string;
  scheduledDate: string | null;
  instructorName: string;
  status: ClassStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewClass {
  serviceId: string;
  productServiceId?: string | null;
  title: string;
  scheduledDate?: string | null;
  instructorName?: string;
  notes?: string;
}

// The standard setup checklist generated whenever a class is created —
// ported from the earlier prototype's per-class task list, kept short
// and generic rather than tied to any one tenant's department names.
export const STANDARD_SETUP_TASKS: string[] = [
  "Confirm venue and schedule",
  "Prepare training materials and equipment",
  "Confirm enrolled candidate list",
  "Brief instructor",
  "Schedule post-class evaluation",
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        title TEXT NOT NULL,
        scheduled_date TEXT,
        instructor_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(classes)`).all() as Array<{ name: string }>).map((c) => c.name)
      );
      if (!cols.has("product_service_id")) db.exec(`ALTER TABLE classes ADD COLUMN product_service_id TEXT`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): ClassRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    productServiceId: (row.product_service_id as string) ?? null,
    title: row.title as string,
    scheduledDate: (row.scheduled_date as string) ?? null,
    instructorName: row.instructor_name as string,
    status: row.status as ClassStatus,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listClasses(orgId: string, serviceId?: string): Promise<ClassRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", product_service_id AS "productServiceId", title,
                  scheduled_date AS "scheduledDate",
                  instructor_name AS "instructorName", status, notes,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM classes WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT ${cols} FROM classes WHERE org_id = $1 ORDER BY created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM classes WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM classes WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Creates the class row, then generates STANDARD_SETUP_TASKS as real
// Task rows tagged to this class (and its service). Not wrapped in a
// database transaction — both drivers here are simple enough (and
// local-dev SQLite has none) that a partial failure is an acceptable,
// visible error rather than a silent one; worth revisiting if this
// grows more steps.
export async function createClass(orgId: string, input: NewClass): Promise<ClassRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const scheduledDate = input.scheduledDate ?? null;
  const instructorName = input.instructorName ?? "";
  const notes = input.notes ?? "";
  const productServiceId = input.productServiceId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO classes (id, org_id, service_id, product_service_id, title, scheduled_date, instructor_name, status, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$9)`,
      [id, orgId, input.serviceId, productServiceId, input.title, scheduledDate, instructorName, notes, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO classes (id, org_id, service_id, product_service_id, title, scheduled_date, instructor_name, status, notes, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'scheduled',?,?,?)`
      )
      .run(id, orgId, input.serviceId, productServiceId, input.title, scheduledDate, instructorName, notes, now, now);
  }

  for (const taskTitle of STANDARD_SETUP_TASKS) {
    await createTask(orgId, { serviceId: input.serviceId, classId: id, title: taskTitle });
  }

  return {
    id,
    serviceId: input.serviceId,
    productServiceId,
    title: input.title,
    scheduledDate,
    instructorName,
    status: "scheduled",
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getClassServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT service_id AS "serviceId" FROM classes WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT service_id FROM classes WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | { service_id: string }
    | undefined;
  return row?.service_id ?? null;
}

export async function updateClassStatus(orgId: string, id: string, status: ClassStatus): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE classes SET status = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [status, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE classes SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, now, orgId, id);
  }
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (ensureSchema() above is otherwise only ever called lazily,
// from this module's own read/write functions). No-op on Postgres, where
// the migrations own the schema.
export function ensureClassesSchema(): Promise<void> {
  return ensureSchema();
}
