// Data layer for the `leads` table — schema in
// supabase/migrations/0004_phase3_pipeline.sql. Same pattern as
// lib/db-tasks.ts (see that file, and lib/db-driver.ts, for the
// org-filtering / RLS notes — not repeated here).

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

// Phase D (portfolio correction, Track 2): generic CRM pipeline
// vocabulary, not PMP's own process language — "assessed"/"admitted"
// read as if GDC only ran one certification-admission workflow.
// "qualified"/"won" describe any Lead's journey toward any sold
// product, matching Phase C's product_service_id anchor.
// supabase/migrations/0024_phased_pipeline_vocabulary.sql renames the
// existing values in place (and the check constraint) for orgs with
// leads already created under the old names.
export type LeadStage = "new" | "contacted" | "qualified" | "won" | "lost";

export interface LeadRow {
  id: string;
  serviceId: string;
  // Phase C (portfolio correction) — which Products & Services Catalog
  // item this lead is actually pursuing, if one was picked. Separate
  // from serviceId on purpose: serviceId is "which internal capability
  // owns this," productServiceId is "what is this person buying." See
  // supabase/migrations/0023_phasec_product_service_anchor.sql.
  productServiceId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stage: LeadStage;
  ownerId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewLead {
  serviceId: string;
  productServiceId?: string | null;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        stage TEXT NOT NULL DEFAULT 'new',
        owner_id TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      // Phase C — same defensive per-column ALTER pattern used
      // throughout this codebase (see lib/db-price-catalog.ts), so an
      // existing local dev.db from before this phase still works.
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(leads)`).all() as Array<{ name: string }>).map((c) => c.name)
      );
      if (!cols.has("product_service_id")) db.exec(`ALTER TABLE leads ADD COLUMN product_service_id TEXT`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): LeadRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    productServiceId: (row.product_service_id as string) ?? null,
    contactName: row.contact_name as string,
    contactEmail: row.contact_email as string,
    contactPhone: row.contact_phone as string,
    stage: row.stage as LeadStage,
    ownerId: (row.owner_id as string) ?? null,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, service_id AS "serviceId", product_service_id AS "productServiceId",
                    contact_name AS "contactName", contact_email AS "contactEmail",
                    contact_phone AS "contactPhone", stage, owner_id AS "ownerId", notes,
                    created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listLeads(orgId: string, serviceId?: string): Promise<LeadRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${PG_COLS} FROM leads WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT ${PG_COLS} FROM leads WHERE org_id = $1 ORDER BY created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM leads WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM leads WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createLead(orgId: string, input: NewLead): Promise<LeadRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const contactEmail = input.contactEmail ?? "";
  const contactPhone = input.contactPhone ?? "";
  const notes = input.notes ?? "";
  const productServiceId = input.productServiceId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO leads (id, org_id, service_id, product_service_id, contact_name, contact_email, contact_phone, stage, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$9,$9)`,
      [id, orgId, input.serviceId, productServiceId, input.contactName, contactEmail, contactPhone, notes, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO leads (id, org_id, service_id, product_service_id, contact_name, contact_email, contact_phone, stage, notes, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'new',?,?,?)`
      )
      .run(id, orgId, input.serviceId, productServiceId, input.contactName, contactEmail, contactPhone, notes, now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    productServiceId,
    contactName: input.contactName,
    contactEmail,
    contactPhone,
    stage: "new",
    ownerId: null,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

// Full lead row, not just its service id — needed by the v3.0 Phase 4
// admission-conversion path (lib/db-engagements.ts's admitLead) to pull
// the contact's name/email/phone across into a Customer.
export async function getLead(orgId: string, id: string): Promise<LeadRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM leads WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM leads WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

// v3.0 roadmap Phase 10 (Cluster C) — used only by
// lib/db-prospects.ts's promoteProspectToLead, to warn (not block) when
// promoting a prospect would create a second lead for someone who
// already has one on file. Plain exact-match by email, same as
// lib/db-customers.ts's findCustomerByEmail — a blank email can't be
// deduped, same documented limitation as that function.
export async function findLeadByEmail(orgId: string, email: string): Promise<LeadRow | null> {
  if (!email) return null;
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM leads WHERE org_id = $1 AND contact_email = $2 ORDER BY created_at DESC LIMIT 1`,
      [orgId, email]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb())
    .prepare(`SELECT * FROM leads WHERE org_id = ? AND contact_email = ? ORDER BY created_at DESC LIMIT 1`)
    .get(orgId, email) as Record<string, unknown> | undefined;
  return row ? fromSqliteRow(row) : null;
}

export async function getLeadServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT service_id AS "serviceId" FROM leads WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT service_id FROM leads WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | { service_id: string }
    | undefined;
  return row?.service_id ?? null;
}

export async function updateLeadStage(orgId: string, id: string, stage: LeadStage): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE leads SET stage = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [stage, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE leads SET stage = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(stage, now, orgId, id);
  }
}

// Phase C — lets staff attach (or clear) which catalog product a lead
// is pursuing after the fact, e.g. once the catalog has real entries
// but the lead was created before it did. Separate from updateLeadStage
// since the two are independent decisions.
export async function updateLeadProductServiceId(orgId: string, id: string, productServiceId: string | null): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE leads SET product_service_id = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [productServiceId, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE leads SET product_service_id = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(productServiceId, now, orgId, id);
  }
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (ensureSchema() above is otherwise only ever called lazily,
// from this module's own read/write functions). No-op on Postgres, where
// the migrations own the schema.
export function ensureLeadsSchema(): Promise<void> {
  return ensureSchema();
}
