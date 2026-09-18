// Data layer for the `price_catalog_items` table — schema in
// supabase/migrations/0021_phase15_commercial_corrections.sql.
// Deliberately a standalone catalog, not the existing `services` table
// (org.db-services.ts's Service & Value Architecture / 5 CVS + 5
// Enabling Services methodology model) — see that migration's file
// comment for why. A billable price list and a methodology catalog are
// two different concepts that just happen to both be "things GDC does
// for customers."
//
// `taxRate` is nullable at rest: null means "use the org's current VAT
// rate," resolved by the caller (the line-item editor) at the moment
// an item is added to a document, then snapshotted onto that line item
// — never re-resolved later, so an org's VAT rate changing (or this
// catalog item's own tax_rate changing) never retroactively alters a
// document that already exists.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface PriceCatalogItem {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  currency: string;
  taxRate: number | null;
  active: boolean;
  sortOrder: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewPriceCatalogItem {
  name: string;
  description?: string;
  unitPrice: number;
  currency: string;
  taxRate?: number | null;
  active?: boolean;
  sortOrder?: number;
  createdByName: string;
}

export interface PriceCatalogItemUpdate {
  name?: string;
  description?: string;
  unitPrice?: number;
  currency?: string;
  taxRate?: number | null;
  active?: boolean;
  sortOrder?: number;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS price_catalog_items (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        unit_price REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'TZS',
        tax_rate REAL,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): PriceCatalogItem {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    unitPrice: Number(row.unit_price ?? 0),
    currency: (row.currency as string) || "TZS",
    taxRate: row.tax_rate === null || row.tax_rate === undefined ? null : Number(row.tax_rate),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
    createdByName: (row.created_by_name as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, name, description, unit_price AS "unitPrice", currency, tax_rate AS "taxRate",
                    active, sort_order AS "sortOrder", created_by_name AS "createdByName",
                    created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listPriceCatalogItems(orgId: string): Promise<PriceCatalogItem[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM price_catalog_items WHERE org_id = $1 ORDER BY sort_order ASC, name ASC`,
      [orgId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM price_catalog_items WHERE org_id = ? ORDER BY sort_order ASC, name ASC`)
    .all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function getPriceCatalogItem(orgId: string, id: string): Promise<PriceCatalogItem | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${PG_COLS} FROM price_catalog_items WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb()).prepare(`SELECT * FROM price_catalog_items WHERE org_id = ? AND id = ?`).get(orgId, id) as
    | Record<string, unknown>
    | undefined;
  return row ? fromSqliteRow(row) : null;
}

export async function createPriceCatalogItem(orgId: string, input: NewPriceCatalogItem): Promise<PriceCatalogItem> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const description = input.description ?? "";
  const taxRate = input.taxRate ?? null;
  const active = input.active ?? true;
  const sortOrder = input.sortOrder ?? 0;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO price_catalog_items (id, org_id, name, description, unit_price, currency, tax_rate, active, sort_order, created_by_name, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
      [id, orgId, input.name, description, input.unitPrice, input.currency, taxRate, active, sortOrder, input.createdByName, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO price_catalog_items (id, org_id, name, description, unit_price, currency, tax_rate, active, sort_order, created_by_name, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.name, description, input.unitPrice, input.currency, taxRate, active ? 1 : 0, sortOrder, input.createdByName, now, now);
  }

  return {
    id, name: input.name, description, unitPrice: input.unitPrice, currency: input.currency, taxRate,
    active, sortOrder, createdByName: input.createdByName, createdAt: now, updatedAt: now,
  };
}

export async function updatePriceCatalogItem(orgId: string, id: string, input: PriceCatalogItemUpdate): Promise<void> {
  await ensureSchema();
  const existing = await getPriceCatalogItem(orgId, id);
  if (!existing) return;
  const now = new Date().toISOString();
  const merged = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    unitPrice: input.unitPrice ?? existing.unitPrice,
    currency: input.currency ?? existing.currency,
    taxRate: input.taxRate === undefined ? existing.taxRate : input.taxRate,
    active: input.active ?? existing.active,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  };

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE price_catalog_items SET name = $1, description = $2, unit_price = $3, currency = $4, tax_rate = $5, active = $6, sort_order = $7, updated_at = $8
       WHERE org_id = $9 AND id = $10`,
      [merged.name, merged.description, merged.unitPrice, merged.currency, merged.taxRate, merged.active, merged.sortOrder, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE price_catalog_items SET name = ?, description = ?, unit_price = ?, currency = ?, tax_rate = ?, active = ?, sort_order = ?, updated_at = ?
         WHERE org_id = ? AND id = ?`
      )
      .run(merged.name, merged.description, merged.unitPrice, merged.currency, merged.taxRate, merged.active ? 1 : 0, merged.sortOrder, now, orgId, id);
  }
}

export function ensurePriceCatalogSchema(): Promise<void> {
  return ensureSchema();
}
