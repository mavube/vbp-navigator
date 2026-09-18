// Data layer for the `engagements` table — schema in
// supabase/migrations/0012_phase4_customer_engagement.sql. An
// Engagement is a Customer's actual journey through one Service — the
// first real, distinct entity for the brief's own
// Customer -> Situation -> Service -> Engagement -> Outcome chain (§2-3).
// Created only by convertLead below (called from app/api/leads/[id]/
// route.ts when a lead's stage becomes 'won' — named admitLead before
// Phase D's generic-pipeline-vocabulary correction), never directly.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { getLead, type LeadRow } from "@/lib/db-leads";
import { findOrCreateCustomerByEmail, type CustomerRow } from "@/lib/db-customers";

export type EngagementStatus = "active" | "completed" | "paused";

export interface EngagementRow {
  id: string;
  customerId: string;
  serviceId: string;
  // Phase C (portfolio correction) — which catalog product this
  // engagement is actually delivering, carried over from the admitted
  // Lead's own productServiceId (if it had one). See lib/db-leads.ts's
  // LeadRow for the same field's reasoning.
  productServiceId: string | null;
  leadId: string | null;
  status: EngagementStatus;
  startedAt: string;
  outcomeNote: string;
  createdAt: string;
  updatedAt: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS engagements (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        lead_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT NOT NULL,
        outcome_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(engagements)`).all() as Array<{ name: string }>).map((c) => c.name)
      );
      if (!cols.has("product_service_id")) db.exec(`ALTER TABLE engagements ADD COLUMN product_service_id TEXT`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): EngagementRow {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    serviceId: row.service_id as string,
    productServiceId: (row.product_service_id as string) ?? null,
    leadId: (row.lead_id as string) ?? null,
    status: row.status as EngagementStatus,
    startedAt: row.started_at as string,
    outcomeNote: row.outcome_note as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, customer_id AS "customerId", service_id AS "serviceId",
                    product_service_id AS "productServiceId", lead_id AS "leadId", status,
                    started_at AS "startedAt", outcome_note AS "outcomeNote",
                    created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listEngagements(orgId: string, customerId?: string): Promise<EngagementRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = customerId
      ? await (await getPgPool()).query(`SELECT ${PG_COLS} FROM engagements WHERE org_id = $1 AND customer_id = $2 ORDER BY started_at DESC`, [orgId, customerId])
      : await (await getPgPool()).query(`SELECT ${PG_COLS} FROM engagements WHERE org_id = $1 ORDER BY started_at DESC`, [orgId]);
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = customerId
    ? db.prepare(`SELECT * FROM engagements WHERE org_id = ? AND customer_id = ? ORDER BY started_at DESC`).all(orgId, customerId)
    : db.prepare(`SELECT * FROM engagements WHERE org_id = ? ORDER BY started_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

// Single-row lookup — needed by the Phase 5 document routes to resolve
// a document's anchor (which service, which customer) before rendering
// a template. listEngagements() above stays list-shaped since nothing
// else has needed a single lookup until now.
export async function getEngagement(orgId: string, id: string): Promise<EngagementRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${PG_COLS} FROM engagements WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM engagements WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

async function createEngagement(orgId: string, input: { customerId: string; serviceId: string; productServiceId?: string | null; leadId?: string | null }): Promise<EngagementRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const leadId = input.leadId ?? null;
  const productServiceId = input.productServiceId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO engagements (id, org_id, customer_id, service_id, product_service_id, lead_id, status, started_at, outcome_note, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,'',$7,$7)`,
      [id, orgId, input.customerId, input.serviceId, productServiceId, leadId, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO engagements (id, org_id, customer_id, service_id, product_service_id, lead_id, status, started_at, outcome_note, created_at, updated_at)
         VALUES (?,?,?,?,?,?,'active',?,'',?,?)`
      )
      .run(id, orgId, input.customerId, input.serviceId, productServiceId, leadId, now, now, now);
  }

  return { id, customerId: input.customerId, serviceId: input.serviceId, productServiceId, leadId, status: "active", startedAt: now, outcomeNote: "", createdAt: now, updatedAt: now };
}

export async function updateEngagementStatus(orgId: string, id: string, status: EngagementStatus, outcomeNote?: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE engagements SET status = $1, outcome_note = COALESCE($2, outcome_note), updated_at = $3 WHERE org_id = $4 AND id = $5`,
      [status, outcomeNote ?? null, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE engagements SET status = ?, outcome_note = COALESCE(?, outcome_note), updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, outcomeNote ?? null, now, orgId, id);
  }
}

// The lead-to-customer conversion step itself — called from
// app/api/leads/[id]/route.ts right after a lead's stage is set to
// 'won' (formerly 'admitted' — see LeadStage in lib/db-leads.ts for
// the Phase D rename). Finds or creates the Customer (by email) and
// opens a new Engagement for this lead's service. Returns null if the
// lead doesn't exist (the caller has already validated this before
// calling updateLeadStage, so that shouldn't happen in practice —
// defensive, not expected).
export async function convertLead(orgId: string, leadId: string): Promise<{ customer: CustomerRow; engagement: EngagementRow } | null> {
  const lead: LeadRow | null = await getLead(orgId, leadId);
  if (!lead) return null;

  const customer = await findOrCreateCustomerByEmail(orgId, {
    fullName: lead.contactName,
    email: lead.contactEmail,
    phone: lead.contactPhone,
    sourceLeadId: lead.id,
  });
  const engagement = await createEngagement(orgId, {
    customerId: customer.id,
    serviceId: lead.serviceId,
    productServiceId: lead.productServiceId,
    leadId: lead.id,
  });
  return { customer, engagement };
}

export function ensureEngagementsSchema(): Promise<void> {
  return ensureSchema();
}
