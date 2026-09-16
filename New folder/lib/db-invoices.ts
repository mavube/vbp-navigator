// Data layer for the `invoices` table — schema in
// supabase/migrations/0006_phase5_budget.sql. Dual-direction per the
// alignment doc Section 6: incoming (a vendor's bill to VBP, tied to an
// Expense) and outgoing (VBP billing a customer, tied to a Class or
// Lead) — both require serviceId regardless of direction.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type InvoiceDirection = "incoming" | "outgoing";
export type InvoiceStatus = "unpaid" | "paid" | "overdue";

export interface InvoiceRow {
  id: string;
  serviceId: string;
  expenseId: string | null;
  classId: string | null;
  leadId: string | null;
  direction: InvoiceDirection;
  party: string;
  amount: number;
  dueDate: string | null;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewInvoice {
  serviceId: string;
  expenseId?: string | null;
  classId?: string | null;
  leadId?: string | null;
  direction: InvoiceDirection;
  party: string;
  amount: number;
  dueDate?: string | null;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        expense_id TEXT,
        class_id TEXT,
        lead_id TEXT,
        direction TEXT NOT NULL,
        party TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'unpaid',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (v3.0 roadmap Phase 7 — revenue rollups) — same pattern as
// lib/db-blockers.ts's ensureBlockersSchema.
export function ensureInvoicesSchema(): Promise<void> {
  return ensureSchema();
}

function fromSqliteRow(row: Record<string, unknown>): InvoiceRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    expenseId: (row.expense_id as string) ?? null,
    classId: (row.class_id as string) ?? null,
    leadId: (row.lead_id as string) ?? null,
    direction: row.direction as InvoiceDirection,
    party: row.party as string,
    amount: row.amount as number,
    dueDate: (row.due_date as string) ?? null,
    status: row.status as InvoiceStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listInvoices(orgId: string, serviceId?: string, direction?: InvoiceDirection): Promise<InvoiceRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", expense_id AS "expenseId", class_id AS "classId", lead_id AS "leadId",
                  direction, party, amount, due_date AS "dueDate", status,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  const conditions: string[] = ["org_id = $1"];
  const params: unknown[] = [orgId];
  if (serviceId) {
    params.push(serviceId);
    conditions.push(`service_id = $${params.length}`);
  }
  if (direction) {
    params.push(direction);
    conditions.push(`direction = $${params.length}`);
  }

  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${cols} FROM invoices WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params
    );
    return res.rows;
  }
  const db = await getSqliteDb();
  let sql = `SELECT * FROM invoices WHERE org_id = ?`;
  const sqliteParams: unknown[] = [orgId];
  if (serviceId) {
    sql += ` AND service_id = ?`;
    sqliteParams.push(serviceId);
  }
  if (direction) {
    sql += ` AND direction = ?`;
    sqliteParams.push(direction);
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...sqliteParams);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createInvoice(orgId: string, input: NewInvoice): Promise<InvoiceRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const expenseId = input.expenseId ?? null;
  const classId = input.classId ?? null;
  const leadId = input.leadId ?? null;
  const dueDate = input.dueDate ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO invoices (id, org_id, service_id, expense_id, class_id, lead_id, direction, party, amount, due_date, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'unpaid',$11,$11)`,
      [id, orgId, input.serviceId, expenseId, classId, leadId, input.direction, input.party, input.amount, dueDate, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO invoices (id, org_id, service_id, expense_id, class_id, lead_id, direction, party, amount, due_date, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'unpaid',?,?)`
      )
      .run(id, orgId, input.serviceId, expenseId, classId, leadId, input.direction, input.party, input.amount, dueDate, now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    expenseId,
    classId,
    leadId,
    direction: input.direction,
    party: input.party,
    amount: input.amount,
    dueDate,
    status: "unpaid",
    createdAt: now,
    updatedAt: now,
  };
}

export async function getInvoiceServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT service_id AS "serviceId" FROM invoices WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT service_id FROM invoices WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | { service_id: string }
    | undefined;
  return row?.service_id ?? null;
}

export async function updateInvoiceStatus(orgId: string, id: string, status: InvoiceStatus): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE invoices SET status = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [status, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE invoices SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, now, orgId, id);
  }
}
