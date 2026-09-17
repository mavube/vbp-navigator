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
    const { Pool, types } = await import("pg");
    // Bug fix (found live in the Tasks Gantt/Calendar views): every
    // `date` column in the schema (tasks.start_date/due_date,
    // invoices.due_date, budget due dates, ...) is declared `date` in
    // the Supabase migrations, but the local SQLite dev schema
    // declares the same columns `TEXT` and stores/returns plain
    // "YYYY-MM-DD" strings. node-postgres's default behavior for the
    // `date` OID (1082) is to parse it into a JS `Date` at UTC
    // midnight — which then serializes through NextResponse.json as a
    // full ISO timestamp ("2026-09-20T00:00:00.000Z"), not the plain
    // date string every UI component (TaskGantt.parseDay, in
    // particular) expects. That mismatch is invisible against local
    // SQLite (real TEXT, never touches this parser) and only shows up
    // against production Postgres — exactly the "Invalid Date" report.
    // Registering this parser makes Postgres return `date` columns as
    // the same raw "YYYY-MM-DD" string SQLite already does, so both
    // drivers behave identically and every consumer can keep treating
    // a date column as a plain string. (This is also why
    // lib/rollups.ts's overdue-tasks query had to cast
    // `due_date::text` for its own string comparison — same
    // underlying mismatch, worked around locally instead of at the
    // source. That cast is left in place; it's harmless now, just
    // no longer the only thing standing between a DATE column and a
    // string comparison.)
    types.setTypeParser(1082 /* date */, (val: string) => val);
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
