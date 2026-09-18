// Data layer for the `customers` table — schema in
// supabase/migrations/0012_phase4_customer_engagement.sql. Originally
// populated only by lib/db-engagements.ts's convertLead (the "prospect
// converts into a full customer record on admission" behavior); v3.0
// roadmap Phase 10 (Cluster C) added a direct create/edit path
// (app/api/customers/route.ts, app/api/customers/[id]/route.ts) for the
// real gap that framing left open — fixing a contact detail after the
// fact, or adding a customer who never came through Pipeline at all
// (e.g. a walk-in). Both paths share the same email-dedupe rule below,
// so a manual "add customer" for an email that already exists reuses
// the existing row instead of creating a duplicate.

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

// Exported (v3.0 roadmap Phase 10) so lib/db-prospects.ts's
// promoteProspectToLead can check for an existing Customer by email
// before creating a second Lead for the same person — see that
// function's own comment for why this is a warning, not a block.
export async function findCustomerByEmail(orgId: string, email: string): Promise<CustomerRow | null> {
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

// v3.0 roadmap Phase 10 (Cluster C) — exported so the new "add a
// customer" form (app/api/customers/route.ts's POST) can create one
// directly, not just via lead admission. Kept as the same function
// admission already used internally, not a parallel insert path.
export async function createCustomer(orgId: string, input: NewCustomer): Promise<CustomerRow> {
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
// than creating a duplicate every time the same person is won into
// a second service down the line. A blank email can't be de-duplicated
// (there's no other reliable identifier on file), so those always
// create a new customer row — a known, documented limitation, not a
// silent gap.
export async function findOrCreateCustomerByEmail(orgId: string, input: NewCustomer): Promise<CustomerRow> {
  const existing = await findCustomerByEmail(orgId, input.email ?? "");
  if (existing) return existing;
  return createCustomer(orgId, input);
}

// v3.0 roadmap Phase 10 (Cluster C) — same dedupe as above, but also
// tells the caller whether it got back an existing row or a freshly
// created one, so app/api/customers/route.ts's manual "add customer"
// form can say so ("this customer already existed") instead of the
// caller re-querying to find out.
export async function findOrCreateCustomerByEmailWithFlag(
  orgId: string,
  input: NewCustomer
): Promise<{ customer: CustomerRow; existed: boolean }> {
  const existing = await findCustomerByEmail(orgId, input.email ?? "");
  if (existing) return { customer: existing, existed: true };
  return { customer: await createCustomer(orgId, input), existed: false };
}

// v3.0 roadmap Phase 10 (Cluster C) — the one other gap besides
// create: fixing a contact detail after the fact (a lead won with
// a typo'd phone number, an org name that changes). Partial update —
// only the fields actually passed are touched, everything else keeps
// its current value via COALESCE, same pattern lib/db-engagements.ts's
// updateEngagementStatus already uses for its optional outcomeNote.
export interface CustomerPatch {
  fullName?: string;
  email?: string;
  phone?: string;
  organizationName?: string;
}

export async function updateCustomer(orgId: string, id: string, patch: CustomerPatch): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE customers SET
         full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         organization_name = COALESCE($4, organization_name),
         updated_at = $5
       WHERE org_id = $6 AND id = $7`,
      [patch.fullName ?? null, patch.email ?? null, patch.phone ?? null, patch.organizationName ?? null, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE customers SET
           full_name = COALESCE(?, full_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           organization_name = COALESCE(?, organization_name),
           updated_at = ?
         WHERE org_id = ? AND id = ?`
      )
      .run(patch.fullName ?? null, patch.email ?? null, patch.phone ?? null, patch.organizationName ?? null, now, orgId, id);
  }
}

export function ensureCustomersSchema(): Promise<void> {
  return ensureSchema();
}
