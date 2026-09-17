// Data layer for `budget_requests` and `quotations` — schema in
// supabase/migrations/0006_phase5_budget.sql. Same org-filtering
// pattern as lib/db-tasks.ts / lib/db-leads.ts (not repeated here).

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type BudgetSource = "petty_cash" | "direct";
export type BudgetStatus = "pending" | "approved" | "rejected";

export interface BudgetRequestRow {
  id: string;
  serviceId: string;
  initiatorId: string | null;
  source: BudgetSource;
  purpose: string;
  amount: number;
  status: BudgetStatus;
  approverId: string | null;
  neededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewBudgetRequest {
  serviceId: string;
  initiatorId?: string | null;
  source: BudgetSource;
  purpose: string;
  amount: number;
  neededBy?: string | null;
}

export interface QuotationRow {
  id: string;
  budgetRequestId: string;
  vendor: string;
  amount: number;
  createdAt: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS budget_requests (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        initiator_id TEXT,
        source TEXT NOT NULL,
        purpose TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approver_id TEXT,
        needed_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      // needed_by (Phase 8.5) was added after this table first shipped —
      // existing local dev.db files predate it, so add it defensively
      // rather than requiring a fresh dev.db (mirrors the Postgres
      // migration's `add column if not exists`, and the identical
      // pattern in lib/db-tasks.ts for tasks.start_date).
      const budgetCols = db.prepare(`PRAGMA table_info(budget_requests)`).all() as Array<{ name: string }>;
      if (!budgetCols.some((c) => c.name === "needed_by")) {
        db.exec(`ALTER TABLE budget_requests ADD COLUMN needed_by TEXT`);
      }
      db.exec(`CREATE TABLE IF NOT EXISTS quotations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        budget_request_id TEXT NOT NULL,
        vendor TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): BudgetRequestRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    initiatorId: (row.initiator_id as string) ?? null,
    source: row.source as BudgetSource,
    purpose: row.purpose as string,
    amount: row.amount as number,
    status: row.status as BudgetStatus,
    approverId: (row.approver_id as string) ?? null,
    neededBy: (row.needed_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listBudgetRequests(orgId: string, serviceId?: string): Promise<BudgetRequestRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", initiator_id AS "initiatorId", source, purpose, amount,
                  status, approver_id AS "approverId", needed_by AS "neededBy", created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM budget_requests WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT ${cols} FROM budget_requests WHERE org_id = $1 ORDER BY created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM budget_requests WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM budget_requests WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Every tenant is expected to have exactly one org-wide Budget Approver
// (Anne at VBP — see alignment doc Section 4), so a new Budget Request
// defaults its approverId to them rather than making the initiator pick
// an approver. Local dev has no real role assignments, so this is null
// there — the approve/reject gate falls back permissively (see
// lib/permissions.ts's canApproveBudget).
export async function getOrgBudgetApproverId(orgId: string): Promise<string | null> {
  if (!IS_POSTGRES) return null;
  const res = await (await getPgPool()).query(
    `SELECT user_id FROM role_assignments WHERE org_id = $1 AND role = 'budget_approver' LIMIT 1`,
    [orgId]
  );
  return res.rows[0]?.user_id ?? null;
}

export async function createBudgetRequest(orgId: string, input: NewBudgetRequest): Promise<BudgetRequestRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const initiatorId = input.initiatorId ?? null;
  const approverId = await getOrgBudgetApproverId(orgId);
  const neededBy = input.neededBy ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO budget_requests (id, org_id, service_id, initiator_id, source, purpose, amount, status, approver_id, needed_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$10)`,
      [id, orgId, input.serviceId, initiatorId, input.source, input.purpose, input.amount, approverId, neededBy, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO budget_requests (id, org_id, service_id, initiator_id, source, purpose, amount, status, approver_id, needed_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, initiatorId, input.source, input.purpose, input.amount, approverId, neededBy, now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    initiatorId,
    source: input.source,
    purpose: input.purpose,
    amount: input.amount,
    status: "pending",
    approverId,
    neededBy,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getBudgetRequestServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT service_id AS "serviceId" FROM budget_requests WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb())
    .prepare(`SELECT service_id FROM budget_requests WHERE org_id = ? AND id = ?`)
    .get(orgId, id) as { service_id: string } | undefined;
  return row?.service_id ?? null;
}

export async function updateBudgetRequestStatus(orgId: string, id: string, status: BudgetStatus): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE budget_requests SET status = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [status, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE budget_requests SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, now, orgId, id);
  }
}

export async function listQuotations(orgId: string, budgetRequestId: string): Promise<QuotationRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, budget_request_id AS "budgetRequestId", vendor, amount, created_at AS "createdAt"
       FROM quotations WHERE org_id = $1 AND budget_request_id = $2 ORDER BY created_at DESC`,
      [orgId, budgetRequestId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM quotations WHERE org_id = ? AND budget_request_id = ? ORDER BY created_at DESC`)
    .all(orgId, budgetRequestId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    budgetRequestId: row.budget_request_id as string,
    vendor: row.vendor as string,
    amount: row.amount as number,
    createdAt: row.created_at as string,
  }));
}

export async function createQuotation(
  orgId: string,
  budgetRequestId: string,
  vendor: string,
  amount: number
): Promise<QuotationRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO quotations (id, org_id, budget_request_id, vendor, amount, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, orgId, budgetRequestId, vendor, amount, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(`INSERT INTO quotations (id, org_id, budget_request_id, vendor, amount, created_at) VALUES (?,?,?,?,?,?)`)
      .run(id, orgId, budgetRequestId, vendor, amount, now);
  }

  return { id, budgetRequestId, vendor, amount, createdAt: now };
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (ensureSchema() above is otherwise only ever called lazily,
// from this module's own read/write functions). No-op on Postgres, where
// the migrations own the schema.
export function ensureBudgetSchema(): Promise<void> {
  return ensureSchema();
}
