// Data layer for the `expenses` table — schema in
// supabase/migrations/0006_phase5_budget.sql. Same pattern as
// lib/db-tasks.ts (not repeated here). An expense may optionally point
// back at the Budget Request it was spent against, but doesn't have to
// (per the alignment doc Section 6 — petty cash / direct spend doesn't
// always start as a formal request).

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface ExpenseRow {
  id: string;
  serviceId: string;
  budgetRequestId: string | null;
  amount: number;
  expenseDate: string;
  description: string;
  receiptUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewExpense {
  serviceId: string;
  budgetRequestId?: string | null;
  amount: number;
  expenseDate?: string;
  description?: string;
  receiptUrl?: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        budget_request_id TEXT,
        amount REAL NOT NULL,
        expense_date TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        receipt_url TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): ExpenseRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    budgetRequestId: (row.budget_request_id as string) ?? null,
    amount: row.amount as number,
    expenseDate: row.expense_date as string,
    description: row.description as string,
    receiptUrl: row.receipt_url as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listExpenses(orgId: string, serviceId?: string): Promise<ExpenseRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", budget_request_id AS "budgetRequestId", amount,
                  expense_date AS "expenseDate", description, receipt_url AS "receiptUrl",
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM expenses WHERE org_id = $1 AND service_id = $2 ORDER BY expense_date DESC, created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT ${cols} FROM expenses WHERE org_id = $1 ORDER BY expense_date DESC, created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM expenses WHERE org_id = ? AND service_id = ? ORDER BY expense_date DESC, created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM expenses WHERE org_id = ? ORDER BY expense_date DESC, created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createExpense(orgId: string, input: NewExpense): Promise<ExpenseRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const budgetRequestId = input.budgetRequestId ?? null;
  const expenseDate = input.expenseDate ?? now.slice(0, 10);
  const description = input.description ?? "";
  const receiptUrl = input.receiptUrl ?? "";

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO expenses (id, org_id, service_id, budget_request_id, amount, expense_date, description, receipt_url, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [id, orgId, input.serviceId, budgetRequestId, input.amount, expenseDate, description, receiptUrl, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO expenses (id, org_id, service_id, budget_request_id, amount, expense_date, description, receipt_url, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, budgetRequestId, input.amount, expenseDate, description, receiptUrl, now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    budgetRequestId,
    amount: input.amount,
    expenseDate,
    description,
    receiptUrl,
    createdAt: now,
    updatedAt: now,
  };
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (ensureSchema() above is otherwise only ever called lazily,
// from this module's own read/write functions). No-op on Postgres, where
// the migrations own the schema.
export function ensureExpensesSchema(): Promise<void> {
  return ensureSchema();
}
