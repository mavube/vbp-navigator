// Data layer for the `prospects` table — schema in
// supabase/migrations/0012_phase4_customer_engagement.sql. The public
// front door: rows here come from the unauthenticated /apply and
// /assess routes (source 'apply' | 'assessment'), reviewed by staff on
// /prospects, and promoted into the existing `leads` table rather than
// running their own separate pipeline — see promoteProspectToLead.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { createLead } from "@/lib/db-leads";

export type ProspectSource = "apply" | "assessment";
export type ProspectStatus = "new" | "reviewed" | "promoted" | "declined";

export interface ProspectRow {
  id: string;
  serviceId: string | null;
  source: ProspectSource;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  assessmentAnswers: Record<string, unknown>;
  status: ProspectStatus;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewProspect {
  serviceId?: string | null;
  source: ProspectSource;
  fullName: string;
  email?: string;
  phone?: string;
  message?: string;
  assessmentAnswers?: Record<string, unknown>;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS prospects (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT,
        source TEXT NOT NULL DEFAULT 'apply',
        full_name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        assessment_answers TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'new',
        lead_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): ProspectRow {
  return {
    id: row.id as string,
    serviceId: (row.service_id as string) ?? null,
    source: row.source as ProspectSource,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: row.phone as string,
    message: row.message as string,
    assessmentAnswers: JSON.parse((row.assessment_answers as string) || "{}"),
    status: row.status as ProspectStatus,
    leadId: (row.lead_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, service_id AS "serviceId", source, full_name AS "fullName", email, phone, message,
                    assessment_answers AS "assessmentAnswers", status, lead_id AS "leadId",
                    created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listProspects(orgId: string): Promise<ProspectRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM prospects WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb()).prepare(`SELECT * FROM prospects WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function getProspect(orgId: string, id: string): Promise<ProspectRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${PG_COLS} FROM prospects WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM prospects WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

// Called only from the unauthenticated public routes
// (app/api/public/org/[slug]/prospects/route.ts) — orgId there is
// resolved server-side from the org's public slug, never taken from
// the request body.
export async function createProspect(orgId: string, input: NewProspect): Promise<ProspectRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const serviceId = input.serviceId ?? null;
  const email = input.email ?? "";
  const phone = input.phone ?? "";
  const message = input.message ?? "";
  const assessmentAnswers = input.assessmentAnswers ?? {};

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO prospects (id, org_id, service_id, source, full_name, email, phone, message, assessment_answers, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10,$10)`,
      [id, orgId, serviceId, input.source, input.fullName, email, phone, message, JSON.stringify(assessmentAnswers), now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO prospects (id, org_id, service_id, source, full_name, email, phone, message, assessment_answers, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,'new',?,?)`
      )
      .run(id, orgId, serviceId, input.source, input.fullName, email, phone, message, JSON.stringify(assessmentAnswers), now, now);
  }

  return {
    id,
    serviceId,
    source: input.source,
    fullName: input.fullName,
    email,
    phone,
    message,
    assessmentAnswers,
    status: "new",
    leadId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateProspectStatus(orgId: string, id: string, status: ProspectStatus, leadId?: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE prospects SET status = $1, lead_id = COALESCE($2, lead_id), updated_at = $3 WHERE org_id = $4 AND id = $5`,
      [status, leadId ?? null, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE prospects SET status = ?, lead_id = COALESCE(?, lead_id), updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, leadId ?? null, now, orgId, id);
  }
}

// Reviewed, not rejected — creates a real Lead (reusing lib/db-leads.ts
// so it enters the exact same pipeline every internally-created lead
// does, rather than a parallel one) and marks the prospect promoted.
// serviceId must be resolved by the caller (the prospect's own
// serviceId if it picked one on /apply or /assess, or one chosen by
// staff during review if it didn't).
export async function promoteProspectToLead(orgId: string, id: string, serviceId: string) {
  const prospect = await getProspect(orgId, id);
  if (!prospect) throw new Error("Prospect not found");

  const lead = await createLead(orgId, {
    serviceId,
    contactName: prospect.fullName,
    contactEmail: prospect.email,
    contactPhone: prospect.phone,
    notes: prospect.message || (prospect.source === "assessment" ? "From the PMP Readiness Assessment intake." : "From the public application form."),
  });

  await updateProspectStatus(orgId, id, "promoted", lead.id);
  return lead;
}

// Exported so lib/rollups.ts (or any future cross-module reporting)
// can force this table into existence on the local SQLite driver
// before querying it directly — no-op on Postgres, where the
// migrations own the schema. Same pattern as every other db-*.ts.
export function ensureProspectsSchema(): Promise<void> {
  return ensureSchema();
}
