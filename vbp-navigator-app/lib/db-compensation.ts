// Data layer for the Compensation Earning Service — `compensation_rate_configs`
// and `compensation_entries`, schema in
// supabase/migrations/0007_phase5_compensation.sql. The payroll math
// itself lives in lib/payroll.ts (kept pure/testable, no DB); this file
// is just persistence plus the one bit of cross-module wiring the
// alignment doc calls for: finalizing an entry generates a real Expense
// against the Compensation Earning Service (Section 7).

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { computeCompensation, DEFAULT_RATE_CONFIG, type AllowanceLine, type DeductionLine, type RateConfig } from "@/lib/payroll";
import { createExpense } from "@/lib/db-expenses";

export type CompensationStatus = "draft" | "finalized";

export interface CompensationEntryRow {
  id: string;
  serviceId: string;
  employeeId: string | null;
  employeeName: string;
  period: string;
  basicPay: number;
  allowances: AllowanceLine[];
  deductions: DeductionLine[];
  netPay: number;
  status: CompensationStatus;
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewCompensationEntry {
  serviceId: string;
  employeeId?: string | null;
  employeeName: string;
  period: string;
  basicPay: number;
  allowances?: AllowanceLine[];
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS compensation_rate_configs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL UNIQUE,
        nssf_employee_rate REAL NOT NULL,
        wcf_rate REAL NOT NULL,
        paye_brackets TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS compensation_entries (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        employee_id TEXT,
        employee_name TEXT NOT NULL DEFAULT '',
        period TEXT NOT NULL,
        basic_pay REAL NOT NULL,
        allowances TEXT NOT NULL DEFAULT '[]',
        deductions TEXT NOT NULL DEFAULT '[]',
        net_pay REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        expense_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

// Reads the org's configured statutory rates, falling back to
// DEFAULT_RATE_CONFIG (and seeding a row with it) the first time an org
// computes a compensation entry — same "auto-seed on first use" pattern
// as lib/db-services.ts's local demo services, so there's always
// something real backing the computation without requiring a setup
// step first.
export async function getRateConfig(orgId: string): Promise<RateConfig> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT nssf_employee_rate AS "nssfEmployeeRate", wcf_rate AS "wcfRate", paye_brackets AS "payeBrackets"
       FROM compensation_rate_configs WHERE org_id = $1`,
      [orgId]
    );
    if (res.rows[0]) return res.rows[0];
    await (await getPgPool()).query(
      `INSERT INTO compensation_rate_configs (id, org_id, nssf_employee_rate, wcf_rate, paye_brackets, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), orgId, DEFAULT_RATE_CONFIG.nssfEmployeeRate, DEFAULT_RATE_CONFIG.wcfRate, JSON.stringify(DEFAULT_RATE_CONFIG.payeBrackets), new Date().toISOString()]
    );
    return DEFAULT_RATE_CONFIG;
  }
  const db = await getSqliteDb();
  const row = db.prepare(`SELECT * FROM compensation_rate_configs WHERE org_id = ?`).get(orgId) as
    | { nssf_employee_rate: number; wcf_rate: number; paye_brackets: string }
    | undefined;
  if (row) {
    return {
      nssfEmployeeRate: row.nssf_employee_rate,
      wcfRate: row.wcf_rate,
      payeBrackets: JSON.parse(row.paye_brackets),
    };
  }
  db.prepare(
    `INSERT INTO compensation_rate_configs (id, org_id, nssf_employee_rate, wcf_rate, paye_brackets, updated_at) VALUES (?,?,?,?,?,?)`
  ).run(randomUUID(), orgId, DEFAULT_RATE_CONFIG.nssfEmployeeRate, DEFAULT_RATE_CONFIG.wcfRate, JSON.stringify(DEFAULT_RATE_CONFIG.payeBrackets), new Date().toISOString());
  return DEFAULT_RATE_CONFIG;
}

function fromSqliteRow(row: Record<string, unknown>): CompensationEntryRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    employeeId: (row.employee_id as string) ?? null,
    employeeName: row.employee_name as string,
    period: row.period as string,
    basicPay: row.basic_pay as number,
    allowances: JSON.parse((row.allowances as string) || "[]"),
    deductions: JSON.parse((row.deductions as string) || "[]"),
    netPay: row.net_pay as number,
    status: row.status as CompensationStatus,
    expenseId: (row.expense_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listCompensationEntries(orgId: string, serviceId?: string): Promise<CompensationEntryRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", employee_id AS "employeeId", employee_name AS "employeeName",
                  period, basic_pay AS "basicPay", allowances, deductions, net_pay AS "netPay", status,
                  expense_id AS "expenseId", created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM compensation_entries WHERE org_id = $1 AND service_id = $2 ORDER BY period DESC, created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT ${cols} FROM compensation_entries WHERE org_id = $1 ORDER BY period DESC, created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM compensation_entries WHERE org_id = ? AND service_id = ? ORDER BY period DESC, created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM compensation_entries WHERE org_id = ? ORDER BY period DESC, created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Computes deductions + Net Pay via lib/payroll.ts using the org's
// configured rates, then persists the result. The breakdown is stored,
// not just the total, so a finalized entry stays auditable even if the
// org's rates change later.
export async function createCompensationEntry(orgId: string, input: NewCompensationEntry): Promise<CompensationEntryRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const allowances = input.allowances ?? [];
  const employeeId = input.employeeId ?? null;

  const rates = await getRateConfig(orgId);
  const { deductions, netPay } = computeCompensation(input.basicPay, allowances, rates);

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO compensation_entries (id, org_id, service_id, employee_id, employee_name, period, basic_pay, allowances, deductions, net_pay, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$11)`,
      [id, orgId, input.serviceId, employeeId, input.employeeName, input.period, input.basicPay, JSON.stringify(allowances), JSON.stringify(deductions), netPay, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO compensation_entries (id, org_id, service_id, employee_id, employee_name, period, basic_pay, allowances, deductions, net_pay, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'draft',?,?)`
      )
      .run(id, orgId, input.serviceId, employeeId, input.employeeName, input.period, input.basicPay, JSON.stringify(allowances), JSON.stringify(deductions), netPay, now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    employeeId,
    employeeName: input.employeeName,
    period: input.period,
    basicPay: input.basicPay,
    allowances,
    deductions,
    netPay,
    status: "draft",
    expenseId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getCompensationEntry(orgId: string, id: string): Promise<CompensationEntryRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, service_id AS "serviceId", employee_id AS "employeeId", employee_name AS "employeeName",
              period, basic_pay AS "basicPay", allowances, deductions, net_pay AS "netPay", status,
              expense_id AS "expenseId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM compensation_entries WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM compensation_entries WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

// The approval step (Anne, per Section 7): marks the entry finalized
// and generates the Expense that feeds it into Budget. Expense amount
// is the gross pay (basic + allowances) — the organization's actual
// cash outlay for this entry, since the deduction lines are amounts
// withheld from the employee and remitted on their behalf, not money
// VBP keeps. (Employer-only contributions, e.g. NSSF's employer share,
// aren't modeled here and would need their own line if added later.)
export async function finalizeCompensationEntry(orgId: string, id: string): Promise<CompensationEntryRow | null> {
  await ensureSchema();
  const entry = await getCompensationEntry(orgId, id);
  if (!entry || entry.status === "finalized") return entry;

  const grossPay = entry.basicPay + entry.allowances.reduce((sum, a) => sum + a.amount, 0);
  const expense = await createExpense(orgId, {
    serviceId: entry.serviceId,
    amount: grossPay,
    description: `Compensation — ${entry.employeeName || "employee"} — ${entry.period}`,
  });

  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE compensation_entries SET status = 'finalized', expense_id = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [expense.id, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE compensation_entries SET status = 'finalized', expense_id = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(expense.id, now, orgId, id);
  }

  return { ...entry, status: "finalized", expenseId: expense.id, updatedAt: now };
}
