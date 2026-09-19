// Data layer for the `invoices` table — schema in
// supabase/migrations/0006_phase5_budget.sql.
//
// As of the invoice-reconciliation pass (2026-09), this table is
// incoming-only going forward: a vendor's bill to VBP, tied to an
// Expense. It originally also carried "outgoing" rows (VBP billing a
// customer, tied to a Class or Lead) per the alignment doc Section 6,
// but that duplicated what Commercial Documents' own
// proposal→quotation→invoice chain already does — a second,
// disconnected "invoice" concept with no customerId/engagementId and
// no currency field. lib/rollups.ts's revenue numbers now read
// Commercial Documents' invoice rows exclusively (see the note on its
// revenue query), and app/api/invoices/route.ts's POST handler rejects
// direction: "outgoing" at the API level. The `InvoiceDirection` type
// still includes "outgoing" so any historical rows from before this
// change keep reading and displaying correctly — nothing here deletes
// existing data — but no new "outgoing" row should ever be created.
// classId/leadId are likewise read-only vestiges of that old path.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type InvoiceDirection = "incoming" | "outgoing";
export type InvoiceStatus = "unpaid" | "paid" | "overdue";

// v3.0 roadmap Phase 10 (Cluster C) — optional structured line items.
// Kept as a bounded array owned by the invoice row itself (same pattern
// as tasks.dependencies / prospects.assessmentAnswers), not a separate
// table with its own join/permission surface. `amount` stays the
// single source of truth for what's owed — when line items are given,
// the API computes it as their sum rather than trusting a client total;
// see app/api/invoices/route.ts.
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
}

export interface InvoiceRow {
  id: string;
  serviceId: string;
  expenseId: string | null;
  classId: string | null;
  leadId: string | null;
  direction: InvoiceDirection;
  party: string;
  amount: number;
  lineItems: InvoiceLineItem[];
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
  lineItems?: InvoiceLineItem[];
  dueDate?: string | null;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        expense_id TEXT,
        class_id TEXT,
        lead_id TEXT,
        direction TEXT NOT NULL,
        party TEXT NOT NULL,
        amount REAL NOT NULL,
        line_items TEXT NOT NULL DEFAULT '[]',
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'unpaid',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      // line_items (Phase 10 of v3.0) was added after this table first
      // shipped — same defensive-ALTER pattern as every other module.
      const cols = db.prepare(`PRAGMA table_info(invoices)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "line_items")) {
        db.exec(`ALTER TABLE invoices ADD COLUMN line_items TEXT NOT NULL DEFAULT '[]'`);
      }
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
    lineItems: JSON.parse((row.line_items as string) || "[]"),
    dueDate: (row.due_date as string) ?? null,
    status: row.status as InvoiceStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listInvoices(orgId: string, serviceId?: string, direction?: InvoiceDirection): Promise<InvoiceRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", expense_id AS "expenseId", class_id AS "classId", lead_id AS "leadId",
                  direction, party, amount, line_items AS "lineItems", due_date AS "dueDate", status,
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
  const lineItems = input.lineItems ?? [];
  const lineItemsJson = JSON.stringify(lineItems);

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO invoices (id, org_id, service_id, expense_id, class_id, lead_id, direction, party, amount, line_items, due_date, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unpaid',$12,$12)`,
      [id, orgId, input.serviceId, expenseId, classId, leadId, input.direction, input.party, input.amount, lineItemsJson, dueDate, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO invoices (id, org_id, service_id, expense_id, class_id, lead_id, direction, party, amount, line_items, due_date, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'unpaid',?,?)`
      )
      .run(id, orgId, input.serviceId, expenseId, classId, leadId, input.direction, input.party, input.amount, lineItemsJson, dueDate, now, now);
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
    lineItems,
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
