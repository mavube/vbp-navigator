// Read access to the `services` table (schema: supabase/migrations/
// 0001_foundation_schema.sql). Services themselves are still created by
// hand — via supabase/seed/vbp_services.sql for a real org, or the local
// auto-seed below for zero-setup dev — there's no create/edit UI yet
// (components/ServiceCards.tsx is still v1.0's static JSX for the
// Service Architecture tab; see the build guide's Phase 1 follow-ups).
// This module exists so Tasks (and later Budget, Pipeline, ...) have
// something real to reference instead of a free-text service name.

import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";
import { randomUUID } from "node:crypto";

export interface ServiceRow {
  id: string;
  type: "cvs" | "enabling";
  name: string;
  department: string;
  providerId: string | null;
  outcome: string;
}

const LOCAL_DEMO_SERVICES: Array<Pick<ServiceRow, "id" | "type" | "name" | "department" | "outcome">> = [
  {
    id: "demo-svc-1",
    type: "cvs",
    name: "Master Class Delivery (demo)",
    department: "Instructor",
    outcome: "Candidates receive the intended learning and capability development.",
  },
  {
    id: "demo-svc-2",
    type: "enabling",
    name: "Service Delivery Management (demo)",
    department: "SDM",
    outcome: "Work across every service stays visible and on track.",
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
        outcome TEXT NOT NULL DEFAULT ''
      )`);
      // outcome was added in Phase 7 (the Capabilities/Outcomes rollup
      // needs a real column to pair its computed numbers with) —
      // existing local dev.db files predate it, added defensively as
      // elsewhere in this codebase.
      const cols = db.prepare(`PRAGMA table_info(services)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "outcome")) {
        db.exec(`ALTER TABLE services ADD COLUMN outcome TEXT NOT NULL DEFAULT ''`);
      }
      const row = db.prepare(`SELECT COUNT(*) as n FROM services WHERE org_id = ?`).get("local-dev") as { n: number };
      if (row.n === 0) {
        const stmt = db.prepare(
          `INSERT INTO services (id, org_id, type, name, department, provider_id, outcome) VALUES (?,?,?,?,?,NULL,?)`
        );
        for (const s of LOCAL_DEMO_SERVICES) {
          stmt.run(s.id, "local-dev", s.type, s.name, s.department, s.outcome);
        }
      }
    })();
  }
  return schemaReady;
}

export async function listServices(orgId: string): Promise<ServiceRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, type, name, department, provider_id AS "providerId", outcome FROM services WHERE org_id = $1 ORDER BY type, name`,
      [orgId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT id, type, name, department, provider_id as providerId, outcome FROM services WHERE org_id = ? ORDER BY type, name`)
    .all(orgId);
  return rows as ServiceRow[];
}

// Only used by the local-dev SQLite path elsewhere if a new demo service
// is ever needed programmatically — kept here so callers don't have to
// know about randomUUID()'s import.
export function newServiceId(): string {
  return randomUUID();
}
