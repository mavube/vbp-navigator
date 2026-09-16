// Data layer for the `customers` table — schema in
// supabase/migrations/0012_phase4_customer_engagement.sql. Populated
// only by lib/db-engagements.ts's admitLead (the "prospect converts
// into a full customer record on admission" behavior) — there's no
// direct create-a-customer form, matching the v3.0 roadmap's framing of
// Customer as the entity a Lead graduates into, not a separate intake.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface CustomerRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  organizationName: string;
  sourceLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewCustomer {
  fullName: string;
  email?: string;
  phone?: string;
  organizationName?: string;
  sourceLeadId?: string | null;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        organization_name TEXT NOT NULL DEFAULT '',
        source_lead_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): CustomerRow {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: row.phone as string,
    organizationName: row.organization_name as string,
    sourceLeadId: (row.source_lead_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, full_name AS "fullName", email, phone, organization_name AS "organizationName",
                    source_lead_id AS "sourceLeadId", created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listCustomers(orgId: string): Promise<CustomerRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM customers WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb()).prepare(`SELECT * FROM customers WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Single-row lookup by id — needed by the Phase 5 document routes to
// resolve a customer's name/email when generating a post-admission
// document against an Engagement.
export async function getCustomerById(orgId: string, id: string): Promise<CustomerRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${PG_COLS} FROM customers WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM customers WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

async function findCustomerByEmail(orgId: string, email: string): Promise<CustomerRow | null> {
  if (!email) return null;
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM customers WHERE org_id = $1 AND email = $2 LIMIT 1`,
      [orgId, email]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM customers WHERE org_id = ? AND email = ? LIMIT 1`).get(orgId, email) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

async function createCustomer(orgId: string, input: NewCustomer): Promise<CustomerRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const email = input.email ?? "";
  const phone = input.phone ?? "";
  const organizationName = input.organizationName ?? "";
  const sourceLeadId = input.sourceLeadId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO customers (id, org_id, full_name, email, phone, organization_name, source_lead_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [id, orgId, input.fullName, email, phone, organizationName, sourceLeadId, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO customers (id, org_id, full_name, email, phone, organization_name, source_lead_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.fullName, email, phone, organizationName, sourceLeadId, now, now);
  }

  return { id, fullName: input.fullName, email, phone, organizationName, sourceLeadId, createdAt: now, updatedAt: now };
}

// The heart of "converts into a full customer record on admission" —
// reuses an existing customer (matched by email within the org) rather
// than creating a duplicate every time the same person is admitted into
// a second service down the line. A blank email can't be de-duplicated
// (there's no other reliable identifier on file), so those always
// create a new customer row — a known, documented limitation, not a
// silent gap.
export async function findOrCreateCustomerByEmail(orgId: string, input: NewCustomer): Promise<CustomerRow> {
  const existing = await findCustomerByEmail(orgId, input.email ?? "");
  if (existing) return existing;
  return createCustomer(orgId, input);
}

export function ensureCustomersSchema(): Promise<void> {
  return ensureSchema();
}
