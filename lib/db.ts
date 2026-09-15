// Data layer for the findings table. See lib/db-driver.ts for the
// Postgres/SQLite driver split and the note on RLS vs. app-level org
// filtering — every function below takes an explicit orgId and filters
// by it, which is what actually scopes data per tenant on this code
// path.
//
// `key` is the stable id from lib/findings-data.ts (e.g. "finding-1");
// `id` (Postgres only) is a generated uuid unique per org — see
// supabase/migrations/0001_foundation_schema.sql.

import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export interface FindingRow {
  key: string;
  status: string;
  note: string;
  updatedAt: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  // Postgres: the Supabase migrations (supabase/migrations/) own this
  // table's shape — don't create it here too.
  if (IS_POSTGRES) return Promise.resolve();

  if (!schemaReady) {
    schemaReady = (async () => {
      const ddl = `CREATE TABLE IF NOT EXISTS findings (
        org_id TEXT NOT NULL,
        key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (org_id, key)
      )`;
      (await getSqliteDb()).exec(ddl);
    })();
  }
  return schemaReady;
}

export async function listFindings(orgId: string): Promise<FindingRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT key, status, note, updated_at AS "updatedAt" FROM findings WHERE org_id = $1`,
      [orgId]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT key, status, note, updated_at as updatedAt FROM findings WHERE org_id = ?`)
    .all(orgId);
  return rows as FindingRow[];
}

export async function getFinding(orgId: string, key: string): Promise<FindingRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT key, status, note, updated_at AS "updatedAt" FROM findings WHERE org_id = $1 AND key = $2`,
      [orgId, key]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb())
    .prepare(`SELECT key, status, note, updated_at as updatedAt FROM findings WHERE org_id = ? AND key = ?`)
    .get(orgId, key);
  return (row as FindingRow) ?? null;
}

export async function upsertFinding(
  orgId: string,
  key: string,
  patch: { status?: string; note?: string }
): Promise<FindingRow> {
  await ensureSchema();
  const existing = await getFinding(orgId, key);
  const status = patch.status ?? existing?.status ?? "open";
  const note = patch.note ?? existing?.note ?? "";
  const updatedAt = new Date().toISOString();

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO findings (org_id, key, status, note, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (org_id, key) DO UPDATE SET status = $3, note = $4, updated_at = $5`,
      [orgId, key, status, note, updatedAt]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO findings (org_id, key, status, note, updated_at) VALUES (?,?,?,?,?)
         ON CONFLICT(org_id, key) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`
      )
      .run(orgId, key, status, note, updatedAt);
  }
  return { key, status, note, updatedAt };
}

export async function seedMissing(orgId: string, keys: string[]): Promise<void> {
  await ensureSchema();
  const existing = new Set((await listFindings(orgId)).map((r) => r.key));
  const missing = keys.filter((key) => !existing.has(key));
  for (const key of missing) {
    await upsertFinding(orgId, key, { status: "open", note: "" });
  }
}
