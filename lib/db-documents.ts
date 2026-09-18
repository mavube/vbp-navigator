// Data layer for the `documents` table — schema in
// supabase/migrations/0013_phase5_documents.sql. Persistence only; the
// actual template rendering lives in lib/document-templates.ts and the
// cross-module data gathering (service/lead/customer/engagement) lives
// in the API routes that call this, same division of responsibility as
// lib/db-engagements.ts's convertLead vs. the leads route that triggers it.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import type { DocumentType } from "@/lib/document-templates";

// Phase 14: commercial documents (proposal/quotation/invoice) use eight
// states; the five plain letter types still use the original four. Kept
// as one union — the API layer is what restricts which values apply to
// which doc_type, same "route checks, lib persists" split as the rest
// of this file.
export type DocumentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "generated"
  | "under_review"
  | "issued"
  | "sent"
  | "delivered"
  | "acknowledged";

export type PaymentStatus = "not_applicable" | "unpaid" | "paid" | "failed" | "refunded";

// Same shape as lib/db-invoices.ts's InvoiceLineItem — kept as a
// separate type rather than imported, because these two "line items"
// concepts belong to different tables/modules (a commercial document
// here vs. the internal AP/AR ledger there) that just happen to need
// the same three fields.
//
// Phase 15 (Diallo's "case 1" corrections): `catalogItemId` and
// `taxRate` are new, optional so a Phase 14 document's existing line
// items (which have neither) keep working unchanged. `unitAmount` is
// always tax-exclusive; `taxRate` is the percentage snapshotted from
// lib/db-price-catalog.ts's PriceCatalogItem (or the org's VAT rate at
// the moment of selection, when the catalog item's own tax_rate is
// null) at the moment this line was added — never re-resolved later,
// so a subsequent catalog or VAT-rate change never retroactively
// changes a document that already exists. `catalogItemId` is null for
// a hand-typed "custom item" line (still supported, for the genuine
// one-off case) — never treated as "legacy" differently from that; the
// only thing that makes a row read-only in the editor is having a
// catalogItemId at all.
export interface DocumentLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  catalogItemId?: string | null;
  taxRate?: number | null;
}

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
  // v3.0 roadmap Phase 10 (Cluster C) — "no file/attachment upload." A
  // plain link, not real file storage — this app has no storage backend
  // wired up, and a link to wherever the file already lives (Drive,
  // SharePoint, email) closes the actual gap without standing up new
  // infrastructure for it. Same pattern as expenses.receiptUrl.
  attachmentUrl: string;
  // --- Phase 14 (commercial documents only; null/defaults for the
  // five plain letter types) ---
  parentDocumentId: string | null;
  amount: number | null;
  currency: string;
  lineItems: DocumentLineItem[];
  dueDate: string | null;
  paymentStatus: PaymentStatus;
  dpoTransToken: string | null;
  dpoTransRef: string | null;
  dpoCompanyRef: string | null;
  paidAt: string | null;
  accessToken: string | null;
  issuedAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  issuedByName: string;
  documentNumber: string | null;
  // Phase 15 — set only by markProposalAccepted, only for docType =
  // 'proposal'. A manual staff attestation ("the customer said yes" —
  // by phone, email, or a signed copy), distinct from the existing
  // `approved` status (that's internal sign-off; this is the
  // customer's own acceptance) — see migration 0021's file comment.
  acceptedAt: string | null;
  acceptedByName: string;
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
  attachmentUrl?: string;
  version?: number;
  previousVersionId?: string | null;
  // Phase 14
  parentDocumentId?: string | null;
  amount?: number | null;
  currency?: string;
  lineItems?: DocumentLineItem[];
  dueDate?: string | null;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS documents (
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
        attachment_url TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      // attachment_url (Phase 10 of v3.0) was added after this table
      // first shipped — same defensive-ALTER pattern as every other
      // module.
      const cols = db.prepare(`PRAGMA table_info(documents)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "attachment_url")) {
        db.exec(`ALTER TABLE documents ADD COLUMN attachment_url TEXT NOT NULL DEFAULT ''`);
      }
      // Phase 14 (production readiness, Area 1) — commercial documents.
      // Same defensive-ALTER pattern; SQLite has no real CHECK-in-place
      // amendment so the widened doc_type/status vocabularies are just
      // enforced at the application layer for local dev, same as every
      // other soft-validated column in this driver.
      const addIfMissing = (name: string, ddl: string) => {
        if (!cols.some((c) => c.name === name)) db.exec(`ALTER TABLE documents ADD COLUMN ${ddl}`);
      };
      addIfMissing("parent_document_id", "parent_document_id TEXT");
      addIfMissing("amount", "amount REAL");
      addIfMissing("currency", "currency TEXT NOT NULL DEFAULT 'TZS'");
      addIfMissing("line_items", "line_items TEXT NOT NULL DEFAULT '[]'");
      addIfMissing("due_date", "due_date TEXT");
      addIfMissing("payment_status", "payment_status TEXT NOT NULL DEFAULT 'not_applicable'");
      addIfMissing("dpo_trans_token", "dpo_trans_token TEXT");
      addIfMissing("dpo_trans_ref", "dpo_trans_ref TEXT");
      addIfMissing("dpo_company_ref", "dpo_company_ref TEXT");
      addIfMissing("paid_at", "paid_at TEXT");
      addIfMissing("access_token", "access_token TEXT");
      addIfMissing("issued_at", "issued_at TEXT");
      addIfMissing("delivered_at", "delivered_at TEXT");
      addIfMissing("acknowledged_at", "acknowledged_at TEXT");
      addIfMissing("issued_by_name", "issued_by_name TEXT NOT NULL DEFAULT ''");
      addIfMissing("document_number", "document_number TEXT");
      // Phase 15 (commercial documents corrections)
      addIfMissing("accepted_at", "accepted_at TEXT");
      addIfMissing("accepted_by_name", "accepted_by_name TEXT NOT NULL DEFAULT ''");
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
    attachmentUrl: (row.attachment_url as string) ?? "",
    parentDocumentId: (row.parent_document_id as string) ?? null,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    currency: (row.currency as string) || "TZS",
    lineItems: JSON.parse((row.line_items as string) || "[]"),
    dueDate: (row.due_date as string) ?? null,
    paymentStatus: ((row.payment_status as string) || "not_applicable") as PaymentStatus,
    dpoTransToken: (row.dpo_trans_token as string) ?? null,
    dpoTransRef: (row.dpo_trans_ref as string) ?? null,
    dpoCompanyRef: (row.dpo_company_ref as string) ?? null,
    paidAt: (row.paid_at as string) ?? null,
    accessToken: (row.access_token as string) ?? null,
    issuedAt: (row.issued_at as string) ?? null,
    deliveredAt: (row.delivered_at as string) ?? null,
    acknowledgedAt: (row.acknowledged_at as string) ?? null,
    issuedByName: (row.issued_by_name as string) ?? "",
    documentNumber: (row.document_number as string) ?? null,
    acceptedAt: (row.accepted_at as string) ?? null,
    acceptedByName: (row.accepted_by_name as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, service_id AS "serviceId", lead_id AS "leadId", engagement_id AS "engagementId",
                    customer_id AS "customerId", doc_type AS "docType", title, body, details,
                    recipient_name AS "recipientName", recipient_email AS "recipientEmail", status, version,
                    previous_version_id AS "previousVersionId", sent_at AS "sentAt",
                    created_by_name AS "createdByName", approved_by_name AS "approvedByName",
                    attachment_url AS "attachmentUrl",
                    parent_document_id AS "parentDocumentId", amount, currency, line_items AS "lineItems",
                    due_date AS "dueDate", payment_status AS "paymentStatus", dpo_trans_token AS "dpoTransToken",
                    dpo_trans_ref AS "dpoTransRef", dpo_company_ref AS "dpoCompanyRef", paid_at AS "paidAt",
                    access_token AS "accessToken", issued_at AS "issuedAt", delivered_at AS "deliveredAt",
                    acknowledged_at AS "acknowledgedAt", issued_by_name AS "issuedByName", document_number AS "documentNumber",
                    accepted_at AS "acceptedAt", accepted_by_name AS "acceptedByName",
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

// Phase 14 — the Documents page (five plain letter types) and the
// Commercial Docs page (proposal/quotation/invoice) share this one
// table but must never show each other's rows, so both now list
// through this filtered query instead of the unfiltered listDocuments
// above (kept for anything that still legitimately wants every type,
// e.g. a future cross-type search).
export async function listDocumentsByTypes(orgId: string, docTypes: DocumentType[]): Promise<DocumentRow[]> {
  await ensureSchema();
  if (docTypes.length === 0) return [];
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM documents WHERE org_id = $1 AND doc_type = ANY($2::text[]) ORDER BY created_at DESC`,
      [orgId, docTypes]
    );
    return res.rows;
  }
  const placeholders = docTypes.map(() => "?").join(",");
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM documents WHERE org_id = ? AND doc_type IN (${placeholders}) ORDER BY created_at DESC`)
    .all(orgId, ...docTypes);
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
  const attachmentUrl = input.attachmentUrl ?? "";
  const parentDocumentId = input.parentDocumentId ?? null;
  const amount = input.amount ?? null;
  const currency = input.currency ?? "TZS";
  const lineItems = input.lineItems ?? [];
  const lineItemsJson = JSON.stringify(lineItems);
  const dueDate = input.dueDate ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO documents (id, org_id, service_id, lead_id, engagement_id, customer_id, doc_type, title, body, details,
                               recipient_name, recipient_email, status, version, previous_version_id, created_by_name, attachment_url,
                               parent_document_id, amount, currency, line_items, due_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)`,
      [id, orgId, input.serviceId, leadId, engagementId, customerId, input.docType, input.title, input.body, input.details,
       input.recipientName, input.recipientEmail, version, previousVersionId, input.createdByName, attachmentUrl,
       parentDocumentId, amount, currency, lineItemsJson, dueDate, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO documents (id, org_id, service_id, lead_id, engagement_id, customer_id, doc_type, title, body, details,
                                 recipient_name, recipient_email, status, version, previous_version_id, created_by_name, attachment_url,
                                 parent_document_id, amount, currency, line_items, due_date, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, leadId, engagementId, customerId, input.docType, input.title, input.body, input.details,
           input.recipientName, input.recipientEmail, version, previousVersionId, input.createdByName, attachmentUrl,
           parentDocumentId, amount, currency, lineItemsJson, dueDate, now, now);
  }

  return {
    id, serviceId: input.serviceId, leadId, engagementId, customerId, docType: input.docType, title: input.title,
    body: input.body, details: input.details, recipientName: input.recipientName, recipientEmail: input.recipientEmail,
    status: "draft", version, previousVersionId, sentAt: null, createdByName: input.createdByName, approvedByName: "",
    attachmentUrl, parentDocumentId, amount, currency, lineItems, dueDate, paymentStatus: "not_applicable",
    dpoTransToken: null, dpoTransRef: null, dpoCompanyRef: null, paidAt: null, accessToken: null,
    issuedAt: null, deliveredAt: null, acknowledgedAt: null, issuedByName: "", documentNumber: null,
    acceptedAt: null, acceptedByName: "",
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

// --- Phase 14 (commercial documents: proposal/quotation/invoice) ---

// Only valid while status = 'draft' — same gate regenerateDocument
// uses. Line items, when given, are the source of truth for amount
// (same "never trust a client total when it can be computed" rule
// app/api/invoices/route.ts already follows) — a flat amount is only
// used when no line items are given at all (e.g. a simple one-line
// proposal with just a headline price).
export async function updateCommercialContent(
  orgId: string,
  id: string,
  input: { title: string; body: string; details: string; lineItems: DocumentLineItem[]; amount: number | null; currency: string; dueDate: string | null }
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  const amount = input.lineItems.length > 0
    ? input.lineItems.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0)
    : input.amount;
  const lineItemsJson = JSON.stringify(input.lineItems);
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET title = $1, body = $2, details = $3, line_items = $4, amount = $5, currency = $6, due_date = $7, updated_at = $8
       WHERE org_id = $9 AND id = $10`,
      [input.title, input.body, input.details, lineItemsJson, amount, input.currency, input.dueDate, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE documents SET title = ?, body = ?, details = ?, line_items = ?, amount = ?, currency = ?, due_date = ?, updated_at = ?
         WHERE org_id = ? AND id = ?`
      )
      .run(input.title, input.body, input.details, lineItemsJson, amount, input.currency, input.dueDate, now, orgId, id);
  }
}

// Generic lifecycle advance for the 8-state commercial flow. Which
// column besides `status` gets stamped depends on the state being
// entered — draft/generated/under_review/approved don't get their own
// timestamp column (updated_at already covers "when did this last
// change"); issued/sent/delivered/acknowledged do, because those are
// the externally-visible moments the directive's "never claim
// sent/delivered falsely" rule is about, and each needs to be provable
// independently of the others.
export async function advanceDocumentStatus(
  orgId: string,
  id: string,
  status: DocumentStatus,
  extra?: { approvedByName?: string; issuedByName?: string; documentNumber?: string; accessToken?: string }
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  const timestampCol =
    status === "issued" ? "issued_at" :
    status === "sent" ? "sent_at" :
    status === "delivered" ? "delivered_at" :
    status === "acknowledged" ? "acknowledged_at" :
    null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET
         status = $1,
         approved_by_name = COALESCE($2, approved_by_name),
         issued_by_name = COALESCE($3, issued_by_name),
         document_number = COALESCE($4, document_number),
         access_token = COALESCE($5, access_token),
         ${timestampCol ? `${timestampCol} = $6,` : ""}
         updated_at = $6
       WHERE org_id = $7 AND id = $8`,
      [status, extra?.approvedByName ?? null, extra?.issuedByName ?? null, extra?.documentNumber ?? null, extra?.accessToken ?? null, now, orgId, id]
    );
  } else {
    const db = await getSqliteDb();
    db.prepare(
      `UPDATE documents SET
         status = ?,
         approved_by_name = COALESCE(?, approved_by_name),
         issued_by_name = COALESCE(?, issued_by_name),
         document_number = COALESCE(?, document_number),
         access_token = COALESCE(?, access_token),
         ${timestampCol ? `${timestampCol} = ?,` : ""}
         updated_at = ?
       WHERE org_id = ? AND id = ?`
    ).run(
      ...[status, extra?.approvedByName ?? null, extra?.issuedByName ?? null, extra?.documentNumber ?? null, extra?.accessToken ?? null,
          ...(timestampCol ? [now] : []), now, orgId, id]
    );
  }
}

export async function recordDpoToken(
  orgId: string,
  id: string,
  input: { dpoTransToken: string; dpoTransRef: string | null; dpoCompanyRef: string }
): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET dpo_trans_token = $1, dpo_trans_ref = $2, dpo_company_ref = $3, payment_status = 'unpaid', updated_at = $4
       WHERE org_id = $5 AND id = $6`,
      [input.dpoTransToken, input.dpoTransRef, input.dpoCompanyRef, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE documents SET dpo_trans_token = ?, dpo_trans_ref = ?, dpo_company_ref = ?, payment_status = 'unpaid', updated_at = ?
         WHERE org_id = ? AND id = ?`
      )
      .run(input.dpoTransToken, input.dpoTransRef, input.dpoCompanyRef, now, orgId, id);
  }
}

// Called only after DPO's verifyToken has confirmed payment — see
// lib/dpo.ts and app/api/public/invoice/[token]/verify/route.ts. Moves
// straight to 'acknowledged': a completed payment is real, external
// proof the customer received and accepted the invoice, not a claim
// this app is making on its own.
export async function recordPayment(orgId: string, id: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET payment_status = 'paid', paid_at = $1, status = 'acknowledged', acknowledged_at = $1, updated_at = $1
       WHERE org_id = $2 AND id = $3`,
      [now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE documents SET payment_status = 'paid', paid_at = ?, status = 'acknowledged', acknowledged_at = ?, updated_at = ?
         WHERE org_id = ? AND id = ?`
      )
      .run(now, now, now, orgId, id);
  }
}

export async function markPaymentFailed(orgId: string, id: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET payment_status = 'failed', updated_at = $1 WHERE org_id = $2 AND id = $3`,
      [now, orgId, id]
    );
  } else {
    (await getSqliteDb()).prepare(`UPDATE documents SET payment_status = 'failed', updated_at = ? WHERE org_id = ? AND id = ?`).run(now, orgId, id);
  }
}

// Phase 15 — a manual staff attestation that the customer accepted a
// Proposal (by phone, email, or a signed copy — this app has no public
// accept-link page yet). The WHERE clause's own doc_type guard is a
// second line of defense on top of the API route's check — belt and
// braces, same reasoning as recordPayment only ever being called from
// a real DPO verifyToken success.
export async function markProposalAccepted(orgId: string, id: string, acceptedByName: string): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE documents SET accepted_at = $1, accepted_by_name = $2, updated_at = $1
       WHERE org_id = $3 AND id = $4 AND doc_type = 'proposal'`,
      [now, acceptedByName, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE documents SET accepted_at = ?, accepted_by_name = ?, updated_at = ?
         WHERE org_id = ? AND id = ? AND doc_type = 'proposal'`
      )
      .run(now, acceptedByName, now, orgId, id);
  }
}

// Public e-invoice link lookup — no orgId available yet (the token
// itself, a random opaque value generated only at issue time and
// stored in a uniquely-indexed column, is what authorizes the request;
// see migration 0020's documents_access_token_idx). Returns orgId
// alongside the row so the caller can then pull that org's branding
// from org_settings.
export async function getDocumentByAccessToken(token: string): Promise<(DocumentRow & { orgId: string }) | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT org_id AS "orgId", ${PG_COLS} FROM documents WHERE access_token = $1`,
      [token]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM documents WHERE access_token = ?`).get(token) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...fromSqliteRow(row), orgId: row.org_id as string };
}
