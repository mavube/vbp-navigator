// Tiny hand-rolled data layer for the findings table — deliberately not an
// ORM. It picks a driver from DATABASE_URL:
//
//   - "postgres://..." / "postgresql://..." -> the `pg` driver (production;
//     Neon, Supabase, Vercel Postgres, RDS, etc. all work).
//   - anything else (default "file:./dev.db") -> Node's built-in
//     `node:sqlite` (zero setup, local dev only — a serverless deployment's
//     filesystem doesn't persist between invocations, so this path is not
//     meant for production).
//
// Why not Prisma: generating the Prisma client requires downloading a
// native query-engine binary at build time from binaries.prisma.sh, which
// is blocked in some sandboxed/offline build environments. This module has
// no such step — `npm install && npm run build` works anywhere `pg` is
// resolvable from npm, which is everywhere.

import type { Pool as PgPool } from "pg";

export interface FindingRow {
  id: string;
  status: string;
  note: string;
  updatedAt: string;
}

const DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
const IS_POSTGRES = /^postgres(ql)?:\/\//i.test(DATABASE_URL);

// ---------------- Postgres ----------------
// Dynamic import (not require) — this file is bundled for both a Turbopack
// and a webpack build, and only a real `import()` of a bare/`node:` module
// specifier gets left alone as a genuine runtime import by both bundlers.
let pgPool: PgPool | null = null;
async function getPgPool(): Promise<PgPool> {
  if (!pgPool) {
    const { Pool } = await import("pg");
    pgPool = new Pool({ connectionString: DATABASE_URL });
  }
  return pgPool as PgPool;
}

// ---------------- SQLite (local dev) ----------------
type SqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
  };
};
let sqliteDb: SqliteDb | null = null;
async function getSqliteDb(): Promise<SqliteDb> {
  if (!sqliteDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const path = DATABASE_URL.replace(/^file:/, "");
    sqliteDb = new DatabaseSync(path) as unknown as SqliteDb;
  }
  return sqliteDb;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const ddl = `CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'open',
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )`;
      if (IS_POSTGRES) {
        await (await getPgPool()).query(ddl);
      } else {
        (await getSqliteDb()).exec(ddl);
      }
    })();
  }
  return schemaReady;
}

export async function listFindings(): Promise<FindingRow[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, status, note, updated_at AS "updatedAt" FROM findings`
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT id, status, note, updated_at as updatedAt FROM findings`)
    .all();
  return rows as FindingRow[];
}

export async function getFinding(id: string): Promise<FindingRow | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT id, status, note, updated_at AS "updatedAt" FROM findings WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb())
    .prepare(`SELECT id, status, note, updated_at as updatedAt FROM findings WHERE id = ?`)
    .get(id);
  return (row as FindingRow) ?? null;
}

export async function upsertFinding(
  id: string,
  patch: { status?: string; note?: string }
): Promise<FindingRow> {
  await ensureSchema();
  const existing = await getFinding(id);
  const status = patch.status ?? existing?.status ?? "open";
  const note = patch.note ?? existing?.note ?? "";
  const updatedAt = new Date().toISOString();

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO findings (id, status, note, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET status = $2, note = $3, updated_at = $4`,
      [id, status, note, updatedAt]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO findings (id, status, note, updated_at) VALUES (?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`
      )
      .run(id, status, note, updatedAt);
  }
  return { id, status, note, updatedAt };
}

export async function seedMissing(ids: string[]): Promise<void> {
  await ensureSchema();
  const existing = new Set((await listFindings()).map((r) => r.id));
  const missing = ids.filter((id) => !existing.has(id));
  for (const id of missing) {
    await upsertFinding(id, { status: "open", note: "" });
  }
}
