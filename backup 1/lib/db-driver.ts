// Shared driver plumbing for lib/db.ts, lib/db-services.ts, and
// lib/db-tasks.ts — factored out so each of those stays focused on its
// own table instead of repeating the Postgres/SQLite setup. Same
// zero-setup-local-dev, real-Postgres-in-production split as v1.0:
// see lib/db.ts's file comment for why (no ORM, no Prisma binary step).
//
// Note on RLS: the Postgres path here connects with whatever role
// DATABASE_URL authenticates as (Supabase's own connection string,
// typically privileged) and does NOT carry a per-request auth.uid() —
// so the RLS policies in supabase/migrations/0002_foundation_rls.sql
// are not what's protecting these queries. Every function in the
// modules that use this driver takes an explicit orgId and filters by
// it in SQL — that app-level filtering is the real isolation boundary
// for this code path. RLS still matters as a second line of defense
// for any query that goes through the Supabase client directly (e.g. a
// future client-side realtime subscription) instead of through these
// server-side functions.

import type { Pool as PgPool } from "pg";

export const DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
export const IS_POSTGRES = /^postgres(ql)?:\/\//i.test(DATABASE_URL);

let pgPool: PgPool | null = null;
export async function getPgPool(): Promise<PgPool> {
  if (!pgPool) {
    const { Pool } = await import("pg");
    pgPool = new Pool({ connectionString: DATABASE_URL });
  }
  return pgPool as PgPool;
}

export type SqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
  };
};
let sqliteDb: SqliteDb | null = null;
export async function getSqliteDb(): Promise<SqliteDb> {
  if (!sqliteDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const path = DATABASE_URL.replace(/^file:/, "");
    sqliteDb = new DatabaseSync(path) as unknown as SqliteDb;
  }
  return sqliteDb;
}
