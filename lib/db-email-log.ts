// Data layer for the `email_log` table — schema in
// supabase/migrations/0020_phase14_commercial_documents.sql. Every real
// email this app sends (currently: a commercial document delivered via
// Mailtrap, see lib/mailtrap.ts and app/api/commercial-documents/[id]/send/route.ts)
// gets exactly one row here, success or failure — this is the audit
// trail the production-readiness directive requires before the app is
// allowed to call a document "Sent."

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface EmailLogRow {
  id: string;
  documentId: string | null;
  toEmail: string;
  subject: string;
  provider: string;
  providerMessageId: string | null;
  status: "sent" | "failed";
  errorMessage: string | null;
  sentByName: string;
  createdAt: string;
}

export interface NewEmailLog {
  documentId?: string | null;
  toEmail: string;
  subject: string;
  provider?: string;
  providerMessageId?: string | null;
  status: "sent" | "failed";
  errorMessage?: string | null;
  sentByName: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS email_log (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        document_id TEXT,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'mailtrap',
        provider_message_id TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        sent_by_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): EmailLogRow {
  return {
    id: row.id as string,
    documentId: (row.document_id as string) ?? null,
    toEmail: row.to_email as string,
    subject: row.subject as string,
    provider: row.provider as string,
    providerMessageId: (row.provider_message_id as string) ?? null,
    status: row.status as "sent" | "failed",
    errorMessage: (row.error_message as string) ?? null,
    sentByName: (row.sent_by_name as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function logEmail(orgId: string, input: NewEmailLog): Promise<EmailLogRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const documentId = input.documentId ?? null;
  const provider = input.provider ?? "mailtrap";
  const providerMessageId = input.providerMessageId ?? null;
  const errorMessage = input.errorMessage ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO email_log (id, org_id, document_id, to_email, subject, provider, provider_message_id, status, error_message, sent_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, orgId, documentId, input.toEmail, input.subject, provider, providerMessageId, input.status, errorMessage, input.sentByName, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO email_log (id, org_id, document_id, to_email, subject, provider, provider_message_id, status, error_message, sent_by_name, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, documentId, input.toEmail, input.subject, provider, providerMessageId, input.status, errorMessage, input.sentByName, now);
  }

  return { id, documentId, toEmail: input.toEmail, subject: input.subject, provider, providerMessageId, status: input.status, errorMessage, sentByName: input.sentByName, createdAt: now };
}

export async function listEmailLogForDocument(orgId: string, documentId: string): Promise<EmailLogRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, document_id AS "documentId", to_email AS "toEmail", subject, provider, provider_message_id AS "providerMessageId",
              status, error_message AS "errorMessage", sent_by_name AS "sentByName", created_at AS "createdAt"
       FROM email_log WHERE org_id = $1 AND document_id = $2 ORDER BY created_at DESC`,
      [orgId, documentId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb()).prepare(`SELECT * FROM email_log WHERE org_id = ? AND document_id = ? ORDER BY created_at DESC`).all(orgId, documentId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export function ensureEmailLogSchema(): Promise<void> {
  return ensureSchema();
}
