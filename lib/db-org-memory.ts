// Data layer for Phase 13 (v3.0 roadmap Phase 9, §17 — Organizational
// Memory), schema in supabase/migrations/0019_phase13_organizational_memory.sql.
// Same dual-driver / org-filtering pattern as every other lib/db-*.ts
// module — see lib/db-driver.ts. Modeled directly on lib/db-blockers.ts.
//
// Two concerns live here because they're the two halves of the same
// phase and share the "no cron in this app" opportunistic-capture
// instinct, not because they're the same shape:
//   - org_memory: decision/lesson entries a person in the org types in.
//   - org_kpi_snapshots: one system-captured row per org per day, so
//     lib/ai-context.ts has something real to diff the live KPIs
//     against for a trend, instead of the trend field Phase 12
//     (Cluster E) deliberately left out.

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type MemoryType = "decision" | "lesson";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  body: string;
  serviceId: string | null;
  authorId: string | null;
  authorName: string;
  createdAt: string;
}

export interface NewMemoryEntry {
  type: MemoryType;
  title: string;
  body?: string;
  serviceId?: string | null;
  authorId?: string | null;
  authorName: string;
}

// The live-KPI shape lib/rollups.ts's getOrgKpiSummary returns — kept
// as a narrow local type (rather than importing OrgKpiSummary, which
// also carries the non-scalar atRiskServices list this table doesn't
// store) so this module has no import-cycle risk with lib/rollups.ts.
export interface KpiSnapshotInput {
  activeWork: number;
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
  costTotal: number;
  netTotal: number;
  servicesHealthy: number;
  servicesAttention: number;
  servicesAtRisk: number;
  blockersHighImpactOpen: number;
  tasksOverdue: number;
}

export interface KpiSnapshotRow extends KpiSnapshotInput {
  id: string;
  snapshotDate: string; // YYYY-MM-DD
  createdAt: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getSqliteDb();
      db.exec(`CREATE TABLE IF NOT EXISTS org_memory (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'lesson',
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        service_id TEXT,
        author_id TEXT,
        author_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS org_kpi_snapshots (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        active_work INTEGER NOT NULL DEFAULT 0,
        revenue_outgoing_total REAL NOT NULL DEFAULT 0,
        revenue_collected_total REAL NOT NULL DEFAULT 0,
        cost_total REAL NOT NULL DEFAULT 0,
        net_total REAL NOT NULL DEFAULT 0,
        services_healthy INTEGER NOT NULL DEFAULT 0,
        services_attention INTEGER NOT NULL DEFAULT 0,
        services_at_risk INTEGER NOT NULL DEFAULT 0,
        blockers_high_impact_open INTEGER NOT NULL DEFAULT 0,
        tasks_overdue INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS org_kpi_snapshots_org_date_idx
        ON org_kpi_snapshots (org_id, snapshot_date)`);
    })();
  }
  return schemaReady;
}

function memoryFromSqliteRow(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row.id as string,
    type: row.type as MemoryType,
    title: row.title as string,
    body: row.body as string,
    serviceId: (row.service_id as string) ?? null,
    authorId: (row.author_id as string) ?? null,
    authorName: row.author_name as string,
    createdAt: row.created_at as string,
  };
}

function snapshotFromSqliteRow(row: Record<string, unknown>): KpiSnapshotRow {
  return {
    id: row.id as string,
    snapshotDate: row.snapshot_date as string,
    activeWork: Number(row.active_work) || 0,
    revenueOutgoingTotal: Number(row.revenue_outgoing_total) || 0,
    revenueCollectedTotal: Number(row.revenue_collected_total) || 0,
    costTotal: Number(row.cost_total) || 0,
    netTotal: Number(row.net_total) || 0,
    servicesHealthy: Number(row.services_healthy) || 0,
    servicesAttention: Number(row.services_attention) || 0,
    servicesAtRisk: Number(row.services_at_risk) || 0,
    blockersHighImpactOpen: Number(row.blockers_high_impact_open) || 0,
    tasksOverdue: Number(row.tasks_overdue) || 0,
    createdAt: row.created_at as string,
  };
}

// ---- org_memory ------------------------------------------------------

const MEMORY_COLS_PG = `id, type, title, body, service_id AS "serviceId", author_id AS "authorId",
                          author_name AS "authorName", created_at AS "createdAt"`;

export async function listMemory(orgId: string, limit = 50): Promise<MemoryEntry[]> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${MEMORY_COLS_PG} FROM org_memory WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit]
    );
    return res.rows;
  }
  const rows = (await getSqliteDb())
    .prepare(`SELECT * FROM org_memory WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(orgId, limit) as Record<string, unknown>[];
  return rows.map(memoryFromSqliteRow);
}

export async function createMemoryEntry(orgId: string, input: NewMemoryEntry): Promise<MemoryEntry> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const body = input.body ?? "";
  const serviceId = input.serviceId ?? null;
  const authorId = input.authorId ?? null;

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO org_memory (id, org_id, type, title, body, service_id, author_id, author_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, orgId, input.type, input.title, body, serviceId, authorId, input.authorName, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO org_memory (id, org_id, type, title, body, service_id, author_id, author_name, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(id, orgId, input.type, input.title, body, serviceId, authorId, input.authorName, now);
  }

  return {
    id,
    type: input.type,
    title: input.title,
    body,
    serviceId,
    authorId,
    authorName: input.authorName,
    createdAt: now,
  };
}

// Exported so lib/ai-context.ts's snapshot builder can cap how much
// history it pulls in without a separate query shape — same "reuse the
// list function, just bound it" instinct as MAX_BLOCKERS elsewhere.
export function ensureOrgMemorySchema(): Promise<void> {
  return ensureSchema();
}

// ---- org_kpi_snapshots -------------------------------------------------

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

// Opportunistic, idempotent capture — called from the Dashboard and
// Advisor API routes on every normal page load, not from a cron (this
// app has none). First load of a given UTC day for an org writes the
// row; every later load that same day is a harmless no-op via ON
// CONFLICT/INSERT OR IGNORE. Never overwrites an already-captured day,
// so a snapshot always reflects that day's *first* read, not its last
// — a deliberate, documented approximation, not a bug: the point is a
// stable "yesterday" to diff against, not a live-updating one.
export async function ensureTodaySnapshot(orgId: string, summary: KpiSnapshotInput): Promise<void> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const date = todayDateStr();

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO org_kpi_snapshots
         (id, org_id, snapshot_date, active_work, revenue_outgoing_total, revenue_collected_total,
          cost_total, net_total, services_healthy, services_attention, services_at_risk,
          blockers_high_impact_open, tasks_overdue, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (org_id, snapshot_date) DO NOTHING`,
      [
        id, orgId, date, summary.activeWork, summary.revenueOutgoingTotal, summary.revenueCollectedTotal,
        summary.costTotal, summary.netTotal, summary.servicesHealthy, summary.servicesAttention,
        summary.servicesAtRisk, summary.blockersHighImpactOpen, summary.tasksOverdue, now,
      ]
    );
    return;
  }
  (await getSqliteDb())
    .prepare(
      `INSERT OR IGNORE INTO org_kpi_snapshots
         (id, org_id, snapshot_date, active_work, revenue_outgoing_total, revenue_collected_total,
          cost_total, net_total, services_healthy, services_attention, services_at_risk,
          blockers_high_impact_open, tasks_overdue, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id, orgId, date, summary.activeWork, summary.revenueOutgoingTotal, summary.revenueCollectedTotal,
      summary.costTotal, summary.netTotal, summary.servicesHealthy, summary.servicesAttention,
      summary.servicesAtRisk, summary.blockersHighImpactOpen, summary.tasksOverdue, now
    );
}

// The most recent snapshot strictly before today — what "trend" diffs
// the live snapshot against. Returns null when none exists yet (a
// brand-new org, or one that hasn't had a page load on an earlier UTC
// day) — lib/ai-context.ts treats null as "no trend available" rather
// than fabricating one, same call this project made for every other
// "nothing real to show yet" case.
export async function getPriorSnapshot(orgId: string): Promise<KpiSnapshotRow | null> {
  await ensureSchema();
  const date = todayDateStr();
  const cols = `id, snapshot_date AS "snapshotDate", active_work AS "activeWork",
                  revenue_outgoing_total AS "revenueOutgoingTotal", revenue_collected_total AS "revenueCollectedTotal",
                  cost_total AS "costTotal", net_total AS "netTotal", services_healthy AS "servicesHealthy",
                  services_attention AS "servicesAttention", services_at_risk AS "servicesAtRisk",
                  blockers_high_impact_open AS "blockersHighImpactOpen", tasks_overdue AS "tasksOverdue",
                  created_at AS "createdAt"`;
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT ${cols} FROM org_kpi_snapshots WHERE org_id = $1 AND snapshot_date < $2 ORDER BY snapshot_date DESC LIMIT 1`,
      [orgId, date]
    );
    return res.rows[0] ?? null;
  }
  const row = (await getSqliteDb())
    .prepare(`SELECT * FROM org_kpi_snapshots WHERE org_id = ? AND snapshot_date < ? ORDER BY snapshot_date DESC LIMIT 1`)
    .get(orgId, date) as Record<string, unknown> | undefined;
  return row ? snapshotFromSqliteRow(row) : null;
}

// Exported for the same lib/rollups.ts-style forced-schema-creation
// reason as ensureOrgMemorySchema above.
export function ensureOrgKpiSnapshotsSchema(): Promise<void> {
  return ensureSchema();
}
