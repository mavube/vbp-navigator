// Read access to the `services` table (schema: supabase/migrations/
// 0001_foundation_schema.sql, extended by 0011_phase2_v3_catalogue.sql).
// Services themselves are still created by hand — via
// supabase/seed/vbp_services.sql for a real org, or the local auto-seed
// below for zero-setup dev — there's no create/edit UI yet.
//
// Extended 2026-09-16 (v3.0 roadmap Phase 2 — Service Catalogue + Graph)
// to select every column the schema actually has, not just the minimal
// subset Phase 2 of v2.0 (Tasks) originally needed for a dropdown:
// recipient, technology, backup_id, depends_on[], feeds[], and the five
// new catalogue fields. This is what components/architecture/* (the
// Service Catalogue and Service Graph, replacing the old static
// ServiceCards.tsx/InternalChain.tsx) actually render.

import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { randomUUID } from "node:crypto";

export interface ServiceRow {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
  providerId: string | null;
  providerName: string | null;
  backupId: string | null;
  backupName: string | null;
  recipient: string;
  outcome: string;
  technology: string;
  description: string;
  customerNeed: string;
  targetCustomer: string;
  deliveryModel: string;
  commercialModel: string;
  dependsOn: string[];
  feeds: string[];
}

const LOCAL_DEMO_SERVICES: Array<
  Pick<ServiceRow, "id" | "type" | "name" | "department" | "outcome" | "recipient" | "dependsOn" | "feeds">
> = [
  {
    id: "demo-svc-2",
    type: "enabling",
    name: "Service Delivery Management (demo)",
    department: "SDM",
    recipient: "Every other service in the org",
    outcome: "Work across every service stays visible and on track.",
    dependsOn: [],
    feeds: ["demo-svc-1"],
  },
  {
    id: "demo-svc-1",
    type: "cvs",
    name: "Master Class Delivery (demo)",
    department: "Instructor",
    recipient: "Candidate",
    outcome: "Candidates receive the intended learning and capability development.",
    dependsOn: ["demo-svc-2"],
    feeds: [],
  },
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        department TEXT NOT NULL DEFAULT '',
        provider_id TEXT,
        backup_id TEXT,
        recipient TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT '',
        technology TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        customer_need TEXT NOT NULL DEFAULT '',
        target_customer TEXT NOT NULL DEFAULT '',
        delivery_model TEXT NOT NULL DEFAULT '',
        commercial_model TEXT NOT NULL DEFAULT '',
        depends_on TEXT NOT NULL DEFAULT '[]',
        feeds TEXT NOT NULL DEFAULT '[]'
      )`);
      // Columns added across phases after this table's original creation
      // — same defensive per-column ALTER pattern used elsewhere in this
      // codebase, so an existing local dev.db from before a given phase
      // still works without deleting it.
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(services)`).all() as Array<{ name: string }>).map((c) => c.name)
      );
      const addIfMissing = (name: string, ddl: string) => {
        if (!cols.has(name)) db.exec(`ALTER TABLE services ADD COLUMN ${ddl}`);
      };
      addIfMissing("outcome", `outcome TEXT NOT NULL DEFAULT ''`);
      addIfMissing("backup_id", `backup_id TEXT`);
      addIfMissing("recipient", `recipient TEXT NOT NULL DEFAULT ''`);
      addIfMissing("technology", `technology TEXT NOT NULL DEFAULT ''`);
      addIfMissing("description", `description TEXT NOT NULL DEFAULT ''`);
      addIfMissing("customer_need", `customer_need TEXT NOT NULL DEFAULT ''`);
      addIfMissing("target_customer", `target_customer TEXT NOT NULL DEFAULT ''`);
      addIfMissing("delivery_model", `delivery_model TEXT NOT NULL DEFAULT ''`);
      addIfMissing("commercial_model", `commercial_model TEXT NOT NULL DEFAULT ''`);
      addIfMissing("depends_on", `depends_on TEXT NOT NULL DEFAULT '[]'`);
      addIfMissing("feeds", `feeds TEXT NOT NULL DEFAULT '[]'`);

      const row = db.prepare(`SELECT COUNT(*) as n FROM services WHERE org_id = ?`).get("local-dev") as { n: number };
      if (row.n === 0) {
        const stmt = db.prepare(
          `INSERT INTO services (id, org_id, type, name, department, provider_id, recipient, outcome, depends_on, feeds)
           VALUES (?,?,?,?,?,NULL,?,?,?,?)`
        );
        for (const s of LOCAL_DEMO_SERVICES) {
          stmt.run(s.id, "local-dev", s.type, s.name, s.department, s.recipient, s.outcome, JSON.stringify(s.dependsOn), JSON.stringify(s.feeds));
        }
      }
    })();
  }
  return schemaReady;
}

// LEFT JOINs to resolve provider_id/backup_id into a display name —
// Postgres-only, since the SQLite local-dev path has no profiles table
// at all (local dev bypasses Supabase Auth entirely, per
// lib/current-org.ts's LOCAL_DEV_ORG_ID path) — providerName/backupName
// come back null there and the UI falls back to "Not assigned".
const PG_SELECT = `
  SELECT
    s.id, s.type, s.name, s.department,
    s.provider_id AS "providerId",
    p.full_name AS "providerName",
    s.backup_id AS "backupId",
    b.full_name AS "backupName",
    s.recipient, s.outcome, s.technology, s.description,
    s.customer_need AS "customerNeed",
    s.target_customer AS "targetCustomer",
    s.delivery_model AS "deliveryModel",
    s.commercial_model AS "commercialModel",
    coalesce(s.depends_on, '{}') AS "dependsOn",
    coalesce(s.feeds, '{}') AS "feeds"
  FROM services s
  LEFT JOIN profiles p ON p.id = s.provider_id
  LEFT JOIN profiles b ON b.id = s.backup_id
  WHERE s.org_id = $1
  ORDER BY s.type, s.name
`;

export async function listServices(orgId: string): Promise<ServiceRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(PG_SELECT, [orgId]);
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(
      `SELECT id, type, name, department, provider_id as providerId, backup_id as backupId,
              recipient, outcome, technology, description,
              customer_need as customerNeed, target_customer as targetCustomer,
              delivery_model as deliveryModel, commercial_model as commercialModel,
              depends_on as dependsOn, feeds as feeds
       FROM services WHERE org_id = ? ORDER BY type, name`
    )
    .all(orgId) as Array<Record<string, unknown>>;

  // SQLite has no native array type — depends_on/feeds are stored as a
  // JSON text column there (Postgres uses a real uuid[] column, hence
  // the coalesce(...,'{}') above instead). Parse back to a real array
  // here so callers never need to know the two drivers store this
  // differently. providerName/backupName have no local-dev equivalent
  // (see PG_SELECT's comment) — always null here.
  return rows.map((r) => ({
    ...r,
    providerName: null,
    backupName: null,
    dependsOn: JSON.parse((r.dependsOn as string) || "[]"),
    feeds: JSON.parse((r.feeds as string) || "[]"),
  })) as ServiceRow[];
}

// Only used by the local-dev SQLite path elsewhere if a new demo service
// is ever needed programmatically — kept here so callers don't have to
// know about randomUUID()'s import.
export function newServiceId(): string {
  return randomUUID();
}
