// Data layer for the `documents` table — schema in
// supabase/migrations/0013_phase5_documents.sql. Persistence only; the
// actual template rendering lives in lib/document-templates.ts and the
// cross-module data gathering (service/lead/customer/engagement) lives
// in the API routes that call this, same division of responsibility as
// lib/db-engagements.ts's admitLead vs. the leads route that triggers it.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import type { DocumentType } from "@/lib/document-templates";

export type DocumentStatus = "draft" | "pending_approval" | "approved" | "rejected";

export interface DocumentRow {
  id: string;
  serviceId: string;
  leadId: string | null;
  engagementId: string | null;
  customerId: string | null;
  docType: DocumentType;
  title: string;
  body: string;
  details: string;
  recipientName: string;
  recipientEmail: string;
  status: DocumentStatus;
  version: number;
  previousVersionId: string | null;
  sentAt: string | null;
  createdByName: string;
  approvedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewDocument {
  serviceId: string;
  leadId?: string | null;
  engagementId?: string | null;
  customerId?: string | null;
  docType: DocumentType;
  title: string;
  body: string;
  details: string;
  recipientName: string;
  recipientEmail: string;
  createdByName: string;
  version?: number;
  previousVersionId?: string | null;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        lead_id TEXT,
        engagement_id TEXT,
        customer_id TEXT,
        doc_type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        recipient_name TEXT NOT NULL DEFAULT '',
        recipient_email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        previous_version_id TEXT,
        sent_at TEXT,
        created_by_name TEXT NOT NULL DEFAULT '',
        approved_by_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): DocumentRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    leadId: (row.lead_id as string) ?? null,
    engagementId: (row.engagement_id as string) ?? null,
    customerId: (row.customer_id as string) ?? null,
    docType: row.doc_type as DocumentType,
    title: row.title as string,
    body: row.body as string,
    details: row.details as string,
    recipientName: row.recipient_name as string,
    recipientEmail: row.recipient_email as string,
    status: row.status as DocumentStatus,
    version: row.version as number,
    previousVersionId: (row.previous_version_id as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    createdByName: row.created_by_name as string,
    approvedByName: row.approved_by_name as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, service_id AS "serviceId", lead_id AS "leadId", engagement_id AS "engagementId",
                    customer_id AS "customerId", doc_type AS "docType", title, body, details,
                    recipient_name AS "recipientName", recipient_email AS "recipientEmail", status, version,
                    previous_version_id AS "previousVersionId", sent_at AS "sentAt",
                    created_by_name AS "createdByName", approved_by_name AS "approvedByName",
                    created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listDocuments(orgId: string): Promise<DocumentRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${PG_COLS} FROM documents WHERE org_id = $1 ORDER BY created_at DESC`, [orgId]);
    return res.rows;
  }
  const rows = (await getSqliteDb()).prepare(`SELECT * FROM documents WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function getDocument(orgId: string, id: string): Promise<DocumentRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${PG_COLS} FROM documents WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM documents WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

export async function createDocument(orgId: string, input: NewDocument): Promise<DocumentRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const version = input.version ?? 1;
  const previousVersionId = input.previousVersionId ?? null;
  const leadId = input.leadId ?? null;
  const engagementId = input.engagementId ?? null;
  const customerId = input.customerId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO documents (id, org_id, service_id, lead_id, engagement_id, customer_id, doc_type, title, body, details,
                               recipient_name, recipient_email, status, version, previous_version_id, created_by_name, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14,$15,$16,$16)`,
      [id, orgId, input.serviceId, leadId, engagementId, customerId, input.docType, input.title, input.body, input.details,
       input.recipientName, input.recipientEmail, version, previousVersionId, input.createdByName, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO documents (id, org_id, service_id, lead_id, engagement_id, customer_id, doc_type, title, body, details,
                                 recipient_name, recipient_email, status, version, previous_version_id, created_by_name, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, leadId, engagementId, customerId, input.docType, input.title, input.body, input.details,
           input.recipientName, input.recipientEmail, version, previousVersionId, input.createdByName, now, now);
  }

  return {
    id, serviceId: input.serviceId, leadId, engagementId, customerId, docType: input.docType, title: input.title,
    body: input.body, details: input.details, recipientName: input.recipientName, recipientEmail: input.recipientEmail,
    status: "draft", version, previousVersionId, sentAt: null, createdByName: input.createdByName, approvedByName: "",
    createdAt: now, updatedAt: now,
  };
}

// Only valid while status = 'draft' (enforced by the caller, not here —
// same "route checks, lib persists" split as updateLeadStage) — re-runs
// the template with new title/body/details, same row, same version.
export async function regenerateDocument(orgId: string, id: string, title: string, body: string, details: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET title = $1, body = $2, details = $3, updated_at = $4 WHERE org_id = $5 AND id = $6`,
      [title, body, details, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE documents SET title = ?, body = ?, details = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(title, body, details, now, orgId, id);
  }
}

export async function updateDocumentStatus(
  orgId: string,
  id: string,
  status: DocumentStatus,
  approvedByName?: string
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET status = $1, approved_by_name = COALESCE($2, approved_by_name), updated_at = $3 WHERE org_id = $4 AND id = $5`,
      [status, approvedByName ?? null, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE documents SET status = ?, approved_by_name = COALESCE(?, approved_by_name), updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, approvedByName ?? null, now, orgId, id);
  }
}

export async function markDocumentSent(orgId: string, id: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(`UPDATE documents SET sent_at = $1, updated_at = $1 WHERE org_id = $2 AND id = $3`, [now, orgId, id]);
  } else {
    (await getSqliteDb()).prepare(`UPDATE documents SET sent_at = ?, updated_at = ? WHERE org_id = ? AND id = ?`).run(now, now, orgId, id);
  }
}

export function ensureDocumentsSchema(): Promise<void> {
  return ensureSchema();
}
