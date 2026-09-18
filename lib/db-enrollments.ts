// Data layer for the `class_enrollments` table — schema in
// supabase/migrations/0017_phase10_business_forms.sql. v3.0 roadmap
// Phase 10 (Cluster C): "no real enrollment/roster entity — 'confirm
// enrolled candidates' is a checklist line, not an actual link to which
// admitted customers are in the class." This is that link. Same
// org-scoped, dual-driver pattern as every other lib/db-*.ts module.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type EnrollmentStatus = "enrolled" | "waitlisted" | "withdrawn";

export interface EnrollmentRow {
  id: string;
  classId: string;
  customerId: string;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS class_enrollments (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'enrolled',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): EnrollmentRow {
  return {
    id: row.id as string,
    classId: row.class_id as string,
    customerId: row.customer_id as string,
    status: row.status as EnrollmentStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, class_id AS "classId", customer_id AS "customerId", status, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listEnrollments(orgId: string, classId: string): Promise<EnrollmentRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM class_enrollments WHERE org_id = $1 AND class_id = $2 ORDER BY created_at ASC`,
      [orgId, classId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM class_enrollments WHERE org_id = ? AND class_id = ? ORDER BY created_at ASC`)
    .all(orgId, classId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Enrolling the same customer twice while they're actively enrolled (or
// waitlisted) is a conflict, not a silent no-op. But the unique
// (class_id, customer_id) index (0017) covers the row regardless of
// status — so a customer who withdrew needs re-enrolling to flip that
// same row back to 'enrolled' rather than insert a second one, or
// withdraw-then-re-enroll would wrongly stay blocked forever. That flip
// is what the "already exists" branch below does when the existing row
// is withdrawn; it only raises when the existing row is still active.
export async function enrollCustomer(orgId: string, classId: string, customerId: string): Promise<EnrollmentRow> {
  await ensureSchema();
  const now = new Date().toISOString();

  if (IS_POSTGRES) {
    const pool = await getPgPool();
    const existing = await pool.query(
      `SELECT ${PG_COLS} FROM class_enrollments WHERE org_id = $1 AND class_id = $2 AND customer_id = $3`,
      [orgId, classId, customerId]
    );
    if (existing.rows[0]) {
      const row: EnrollmentRow = existing.rows[0];
      if (row.status !== "withdrawn") throw new Error("This customer is already enrolled in this class");
      await pool.query(`UPDATE class_enrollments SET status = 'enrolled', updated_at = $1 WHERE id = $2`, [now, row.id]);
      return { ...row, status: "enrolled", updatedAt: now };
    }
    const id = randomUUID();
    await pool.query(
      `INSERT INTO class_enrollments (id, org_id, class_id, customer_id, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'enrolled',$5,$5)`,
      [id, orgId, classId, customerId, now]
    );
    return { id, classId, customerId, status: "enrolled", createdAt: now, updatedAt: now };
  }

  const db = await getSqliteDb();
  const existingRow = db
    .prepare(`SELECT * FROM class_enrollments WHERE org_id = ? AND class_id = ? AND customer_id = ?`)
    .get(orgId, classId, customerId) as Record<string, unknown> | undefined;
  if (existingRow) {
    const row = fromSqliteRow(existingRow);
    if (row.status !== "withdrawn") throw new Error("This customer is already enrolled in this class");
    db.prepare(`UPDATE class_enrollments SET status = 'enrolled', updated_at = ? WHERE id = ?`).run(now, row.id);
    return { ...row, status: "enrolled", updatedAt: now };
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO class_enrollments (id, org_id, class_id, customer_id, status, created_at, updated_at)
     VALUES (?,?,?,?,'enrolled',?,?)`
  ).run(id, orgId, classId, customerId, now, now);
  return { id, classId, customerId, status: "enrolled", createdAt: now, updatedAt: now };
}

// Phase E (Customer Workspace rebuild) — the reverse lookup of
// listEnrollments above: every class a given customer is (or was)
// enrolled in, across all classes, not just one. Used to assemble a
// customer's own activity view rather than a class roster.
export async function listEnrollmentsByCustomer(orgId: string, customerId: string): Promise<EnrollmentRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM class_enrollments WHERE org_id = $1 AND customer_id = $2 ORDER BY created_at DESC`,
      [orgId, customerId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM class_enrollments WHERE org_id = ? AND customer_id = ? ORDER BY created_at DESC`)
    .all(orgId, customerId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function updateEnrollmentStatus(orgId: string, id: string, status: EnrollmentStatus): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE class_enrollments SET status = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [status, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE class_enrollments SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, now, orgId, id);
  }
}

export function ensureEnrollmentsSchema(): Promise<void> {
  return ensureSchema();
}
