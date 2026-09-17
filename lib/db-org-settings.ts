// Data layer for the `org_settings` table — schema in
// supabase/migrations/0020_phase14_commercial_documents.sql. One row
// per org, holding the legal/banking identity that flows onto every
// generated commercial document's PDF footer (Company Settings, Phase
// 14 production-readiness Area 1) plus the non-secret half of the
// Turnstile/Mailtrap configuration. The corresponding secrets
// (Turnstile secret key, Mailtrap API token, DPO credentials) live in
// environment variables — see .env.example — never in this table,
// because this table is readable back through a settings UI and a
// server-side verification secret must not be.
//
// Same "lazily-created single row per org" shape as nothing else in
// this app quite has — closest precedent is a Class or Service, but
// those are many-per-org. Reads return sensible empty defaults when no
// row exists yet (a brand-new org hasn't filled in its settings),
// rather than null, so every caller (PDF generation especially) can
// treat "no settings saved yet" and "settings saved but blank" the same
// way — write whatever fields are non-empty, leave the rest off the
// document rather than crashing.

import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface OrgSettings {
  legalName: string;
  registrationNumber: string;
  tin: string;
  address: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  vatRegistered: boolean;
  vatNumber: string;
  vatRate: number;
  defaultCurrency: string;
  paymentTermsText: string;
  turnstileSiteKey: string;
  mailtrapFromEmail: string;
  mailtrapFromName: string;
  updatedByName: string;
  updatedAt: string | null;
}

export const EMPTY_ORG_SETTINGS: OrgSettings = {
  legalName: "",
  registrationNumber: "",
  tin: "",
  address: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankBranch: "",
  vatRegistered: false,
  vatNumber: "",
  vatRate: 0,
  defaultCurrency: "TZS",
  paymentTermsText: "",
  turnstileSiteKey: "",
  mailtrapFromEmail: "",
  mailtrapFromName: "",
  updatedByName: "",
  updatedAt: null,
};

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS org_settings (
        org_id TEXT PRIMARY KEY,
        legal_name TEXT NOT NULL DEFAULT '',
        registration_number TEXT NOT NULL DEFAULT '',
        tin TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        bank_name TEXT NOT NULL DEFAULT '',
        bank_account_name TEXT NOT NULL DEFAULT '',
        bank_account_number TEXT NOT NULL DEFAULT '',
        bank_branch TEXT NOT NULL DEFAULT '',
        vat_registered INTEGER NOT NULL DEFAULT 0,
        vat_number TEXT NOT NULL DEFAULT '',
        vat_rate REAL NOT NULL DEFAULT 0,
        default_currency TEXT NOT NULL DEFAULT 'TZS',
        payment_terms_text TEXT NOT NULL DEFAULT '',
        turnstile_site_key TEXT NOT NULL DEFAULT '',
        mailtrap_from_email TEXT NOT NULL DEFAULT '',
        mailtrap_from_name TEXT NOT NULL DEFAULT '',
        updated_by_name TEXT NOT NULL DEFAULT '',
        updated_at TEXT
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): OrgSettings {
  return {
    legalName: (row.legal_name as string) ?? "",
    registrationNumber: (row.registration_number as string) ?? "",
    tin: (row.tin as string) ?? "",
    address: (row.address as string) ?? "",
    bankName: (row.bank_name as string) ?? "",
    bankAccountName: (row.bank_account_name as string) ?? "",
    bankAccountNumber: (row.bank_account_number as string) ?? "",
    bankBranch: (row.bank_branch as string) ?? "",
    vatRegistered: Boolean(row.vat_registered),
    vatNumber: (row.vat_number as string) ?? "",
    vatRate: Number(row.vat_rate ?? 0),
    defaultCurrency: (row.default_currency as string) || "TZS",
    paymentTermsText: (row.payment_terms_text as string) ?? "",
    turnstileSiteKey: (row.turnstile_site_key as string) ?? "",
    mailtrapFromEmail: (row.mailtrap_from_email as string) ?? "",
    mailtrapFromName: (row.mailtrap_from_name as string) ?? "",
    updatedByName: (row.updated_by_name as string) ?? "",
    updatedAt: (row.updated_at as string) ?? null,
  };
}

const PG_COLS = `legal_name AS "legalName", registration_number AS "registrationNumber", tin, address,
                    bank_name AS "bankName", bank_account_name AS "bankAccountName", bank_account_number AS "bankAccountNumber",
                    bank_branch AS "bankBranch", vat_registered AS "vatRegistered", vat_number AS "vatNumber", vat_rate AS "vatRate",
                    default_currency AS "defaultCurrency", payment_terms_text AS "paymentTermsText",
                    turnstile_site_key AS "turnstileSiteKey", mailtrap_from_email AS "mailtrapFromEmail",
                    mailtrap_from_name AS "mailtrapFromName", updated_by_name AS "updatedByName", updated_at AS "updatedAt"`;

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(`SELECT ${PG_COLS} FROM org_settings WHERE org_id = $1`, [orgId]);
    return res.rows[0] ?? EMPTY_ORG_SETTINGS;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM org_settings WHERE org_id = ?`).get(orgId) as Record<string, unknown> | undefined;
  return row ? fromSqliteRow(row) : EMPTY_ORG_SETTINGS;
}

export async function upsertOrgSettings(orgId: string, input: Omit<OrgSettings, "updatedAt">): Promise<OrgSettings> {
  await ensureSchema();
  const now = new Date().toISOString();

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO org_settings (org_id, legal_name, registration_number, tin, address, bank_name, bank_account_name,
                                  bank_account_number, bank_branch, vat_registered, vat_number, vat_rate, default_currency,
                                  payment_terms_text, turnstile_site_key, mailtrap_from_email, mailtrap_from_name, updated_by_name, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (org_id) DO UPDATE SET
         legal_name = $2, registration_number = $3, tin = $4, address = $5, bank_name = $6, bank_account_name = $7,
         bank_account_number = $8, bank_branch = $9, vat_registered = $10, vat_number = $11, vat_rate = $12,
         default_currency = $13, payment_terms_text = $14, turnstile_site_key = $15, mailtrap_from_email = $16,
         mailtrap_from_name = $17, updated_by_name = $18, updated_at = $19`,
      [orgId, input.legalName, input.registrationNumber, input.tin, input.address, input.bankName, input.bankAccountName,
       input.bankAccountNumber, input.bankBranch, input.vatRegistered, input.vatNumber, input.vatRate, input.defaultCurrency,
       input.paymentTermsText, input.turnstileSiteKey, input.mailtrapFromEmail, input.mailtrapFromName, input.updatedByName, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO org_settings (org_id, legal_name, registration_number, tin, address, bank_name, bank_account_name,
                                    bank_account_number, bank_branch, vat_registered, vat_number, vat_rate, default_currency,
                                    payment_terms_text, turnstile_site_key, mailtrap_from_email, mailtrap_from_name, updated_by_name, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (org_id) DO UPDATE SET
           legal_name = excluded.legal_name, registration_number = excluded.registration_number, tin = excluded.tin,
           address = excluded.address, bank_name = excluded.bank_name, bank_account_name = excluded.bank_account_name,
           bank_account_number = excluded.bank_account_number, bank_branch = excluded.bank_branch,
           vat_registered = excluded.vat_registered, vat_number = excluded.vat_number, vat_rate = excluded.vat_rate,
           default_currency = excluded.default_currency, payment_terms_text = excluded.payment_terms_text,
           turnstile_site_key = excluded.turnstile_site_key, mailtrap_from_email = excluded.mailtrap_from_email,
           mailtrap_from_name = excluded.mailtrap_from_name, updated_by_name = excluded.updated_by_name, updated_at = excluded.updated_at`
      )
      .run(orgId, input.legalName, input.registrationNumber, input.tin, input.address, input.bankName, input.bankAccountName,
           input.bankAccountNumber, input.bankBranch, input.vatRegistered ? 1 : 0, input.vatNumber, input.vatRate, input.defaultCurrency,
           input.paymentTermsText, input.turnstileSiteKey, input.mailtrapFromEmail, input.mailtrapFromName, input.updatedByName, now);
  }

  return { ...input, updatedAt: now };
}

export function ensureOrgSettingsSchema(): Promise<void> {
  return ensureSchema();
}
