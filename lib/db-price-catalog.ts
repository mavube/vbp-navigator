// Data layer for the `price_catalog_items` table — schema in
// supabase/migrations/0021_phase15_commercial_corrections.sql, extended
// by 0022_phase16_products_services_catalog.sql. Deliberately a
// standalone catalog, not the existing `services` table (lib/db-
// services.ts's Service & Value Architecture / 5 CVS + 5 Enabling
// Services methodology model) — see that migration's file comment for
// why. A billable price list and a methodology catalog are two
// different concepts that just happen to both be "things GDC does for
// customers."
//
// Phase 16 (portfolio correction, part 1): this table's role expanded
// from "billing line-item picker" to "the actual Products & Services
// Catalog" — GDC's real, sellable portfolio (PMP Master Class, MS
// Project Training, ValueBlueprint(R) Advisory, ...), not just prices.
// The new fields are the offering *definition*; unitPrice/currency/
// taxRate/active are unchanged from Phase 15.
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
  // Phase 16 — offering-definition fields. All free text except
  // requiredCapabilities, which is a soft (unenforced) list of
  // lib/db-services.ts service ids this offering typically draws on.
  category: string;
  offeringType: string;
  targetCustomer: string;
  standardOffering: string;
  deliveryModel: string;
  typicalDuration: string;
  pricingModel: string;
  included: string;
  expectedOutcome: string;
  requiredCapabilities: string[];
  relatedDocuments: string;
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
  category?: string;
  offeringType?: string;
  targetCustomer?: string;
  standardOffering?: string;
  deliveryModel?: string;
  typicalDuration?: string;
  pricingModel?: string;
  included?: string;
  expectedOutcome?: string;
  requiredCapabilities?: string[];
  relatedDocuments?: string;
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
  category?: string;
  offeringType?: string;
  targetCustomer?: string;
  standardOffering?: string;
  deliveryModel?: string;
  typicalDuration?: string;
  pricingModel?: string;
  included?: string;
  expectedOutcome?: string;
  requiredCapabilities?: string[];
  relatedDocuments?: string;
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
      // Phase 16 columns — same defensive per-column ALTER pattern used
      // everywhere else in this codebase, so an existing local dev.db
      // from before this phase still works without deleting it.
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(price_catalog_items)`).all() as Array<{ name: string }>).map((c) => c.name)
      );
      const addIfMissing = (name: string, ddl: string) => {
        if (!cols.has(name)) db.exec(`ALTER TABLE price_catalog_items ADD COLUMN ${ddl}`);
      };
      addIfMissing("category", `category TEXT NOT NULL DEFAULT ''`);
      addIfMissing("offering_type", `offering_type TEXT NOT NULL DEFAULT ''`);
      addIfMissing("target_customer", `target_customer TEXT NOT NULL DEFAULT ''`);
      addIfMissing("standard_offering", `standard_offering TEXT NOT NULL DEFAULT ''`);
      addIfMissing("delivery_model", `delivery_model TEXT NOT NULL DEFAULT ''`);
      addIfMissing("typical_duration", `typical_duration TEXT NOT NULL DEFAULT ''`);
      addIfMissing("pricing_model", `pricing_model TEXT NOT NULL DEFAULT ''`);
      addIfMissing("included", `included TEXT NOT NULL DEFAULT ''`);
      addIfMissing("expected_outcome", `expected_outcome TEXT NOT NULL DEFAULT ''`);
      // SQLite has no native array type — required_capabilities is
      // stored as JSON text here, same pattern lib/db-services.ts uses
      // for depends_on/feeds (see that file's PG_SELECT comment).
      addIfMissing("required_capabilities", `required_capabilities TEXT NOT NULL DEFAULT '[]'`);
      addIfMissing("related_documents", `related_documents TEXT NOT NULL DEFAULT ''`);
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
    category: (row.category as string) ?? "",
    offeringType: (row.offering_type as string) ?? "",
    targetCustomer: (row.target_customer as string) ?? "",
    standardOffering: (row.standard_offering as string) ?? "",
    deliveryModel: (row.delivery_model as string) ?? "",
    typicalDuration: (row.typical_duration as string) ?? "",
    pricingModel: (row.pricing_model as string) ?? "",
    included: (row.included as string) ?? "",
    expectedOutcome: (row.expected_outcome as string) ?? "",
    requiredCapabilities: JSON.parse((row.required_capabilities as string) || "[]"),
    relatedDocuments: (row.related_documents as string) ?? "",
    createdByName: (row.created_by_name as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const PG_COLS = `id, name, description, unit_price AS "unitPrice", currency, tax_rate AS "taxRate",
                    active, sort_order AS "sortOrder",
                    category, offering_type AS "offeringType", target_customer AS "targetCustomer",
                    standard_offering AS "standardOffering", delivery_model AS "deliveryModel",
                    typical_duration AS "typicalDuration", pricing_model AS "pricingModel",
                    included, expected_outcome AS "expectedOutcome",
                    coalesce(required_capabilities, '{}') AS "requiredCapabilities",
                    related_documents AS "relatedDocuments",
                    created_by_name AS "createdByName",
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
  const category = input.category ?? "";
  const offeringType = input.offeringType ?? "";
  const targetCustomer = input.targetCustomer ?? "";
  const standardOffering = input.standardOffering ?? "";
  const deliveryModel = input.deliveryModel ?? "";
  const typicalDuration = input.typicalDuration ?? "";
  const pricingModel = input.pricingModel ?? "";
  const included = input.included ?? "";
  const expectedOutcome = input.expectedOutcome ?? "";
  const requiredCapabilities = input.requiredCapabilities ?? [];
  const relatedDocuments = input.relatedDocuments ?? "";

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO price_catalog_items (
         id, org_id, name, description, unit_price, currency, tax_rate, active, sort_order,
         category, offering_type, target_customer, standard_offering, delivery_model,
         typical_duration, pricing_model, included, expected_outcome, required_capabilities,
         related_documents, created_by_name, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)`,
      [
        id, orgId, input.name, description, input.unitPrice, input.currency, taxRate, active, sortOrder,
        category, offeringType, targetCustomer, standardOffering, deliveryModel,
        typicalDuration, pricingModel, included, expectedOutcome, requiredCapabilities,
        relatedDocuments, input.createdByName, now,
      ]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO price_catalog_items (
           id, org_id, name, description, unit_price, currency, tax_rate, active, sort_order,
           category, offering_type, target_customer, standard_offering, delivery_model,
           typical_duration, pricing_model, included, expected_outcome, required_capabilities,
           related_documents, created_by_name, created_at, updated_at
         )
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        id, orgId, input.name, description, input.unitPrice, input.currency, taxRate, active ? 1 : 0, sortOrder,
        category, offeringType, targetCustomer, standardOffering, deliveryModel,
        typicalDuration, pricingModel, included, expectedOutcome, JSON.stringify(requiredCapabilities),
        relatedDocuments, input.createdByName, now, now
      );
  }

  return {
    id, name: input.name, description, unitPrice: input.unitPrice, currency: input.currency, taxRate,
    active, sortOrder, category, offeringType, targetCustomer, standardOffering, deliveryModel,
    typicalDuration, pricingModel, included, expectedOutcome, requiredCapabilities, relatedDocuments,
    createdByName: input.createdByName, createdAt: now, updatedAt: now,
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
    category: input.category ?? existing.category,
    offeringType: input.offeringType ?? existing.offeringType,
    targetCustomer: input.targetCustomer ?? existing.targetCustomer,
    standardOffering: input.standardOffering ?? existing.standardOffering,
    deliveryModel: input.deliveryModel ?? existing.deliveryModel,
    typicalDuration: input.typicalDuration ?? existing.typicalDuration,
    pricingModel: input.pricingModel ?? existing.pricingModel,
    included: input.included ?? existing.included,
    expectedOutcome: input.expectedOutcome ?? existing.expectedOutcome,
    requiredCapabilities: input.requiredCapabilities ?? existing.requiredCapabilities,
    relatedDocuments: input.relatedDocuments ?? existing.relatedDocuments,
  };

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE price_catalog_items SET
         name = $1, description = $2, unit_price = $3, currency = $4, tax_rate = $5, active = $6, sort_order = $7,
         category = $8, offering_type = $9, target_customer = $10, standard_offering = $11, delivery_model = $12,
         typical_duration = $13, pricing_model = $14, included = $15, expected_outcome = $16,
         required_capabilities = $17, related_documents = $18, updated_at = $19
       WHERE org_id = $20 AND id = $21`,
      [
        merged.name, merged.description, merged.unitPrice, merged.currency, merged.taxRate, merged.active, merged.sortOrder,
        merged.category, merged.offeringType, merged.targetCustomer, merged.standardOffering, merged.deliveryModel,
        merged.typicalDuration, merged.pricingModel, merged.included, merged.expectedOutcome,
        merged.requiredCapabilities, merged.relatedDocuments, now, orgId, id,
      ]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `UPDATE price_catalog_items SET
           name = ?, description = ?, unit_price = ?, currency = ?, tax_rate = ?, active = ?, sort_order = ?,
           category = ?, offering_type = ?, target_customer = ?, standard_offering = ?, delivery_model = ?,
           typical_duration = ?, pricing_model = ?, included = ?, expected_outcome = ?,
           required_capabilities = ?, related_documents = ?, updated_at = ?
         WHERE org_id = ? AND id = ?`
      )
      .run(
        merged.name, merged.description, merged.unitPrice, merged.currency, merged.taxRate, merged.active ? 1 : 0, merged.sortOrder,
        merged.category, merged.offeringType, merged.targetCustomer, merged.standardOffering, merged.deliveryModel,
        merged.typicalDuration, merged.pricingModel, merged.included, merged.expectedOutcome,
        JSON.stringify(merged.requiredCapabilities), merged.relatedDocuments, now, orgId, id
      );
  }
}

export function ensurePriceCatalogSchema(): Promise<void> {
  return ensureSchema();
}
