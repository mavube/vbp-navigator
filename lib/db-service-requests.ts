// Data layer for the `service_requests` table — schema in
// supabase/migrations/0008_phase6_service_requests.sql. Same pattern as
// lib/db-tasks.ts / lib/db-leads.ts (not repeated here).

import { randomUUID } from "node:crypto";
import { IS_POSTGRES, getPgPool, getSqliteDb } from "@/lib/db-driver";

export type RequestType = "request" | "incident";
export type RequestPriority = "low" | "medium" | "high" | "urgent";
export type RequestStatus = "open" | "in_progress" | "resolved" | "closed";

export interface ServiceRequestRow {
  id: string;
  serviceId: string;
  requesterId: string | null;
  requesterName: string;
  type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewServiceRequest {
  serviceId: string;
  requesterId?: string | null;
  requesterName?: string;
  type?: RequestType;
  priority?: RequestPriority;
  title: string;
  description?: string;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (IS_POSTGRES) return Promise.resolve(); // owned by the Supabase migrations

  if (!schemaReady) {
    schemaReady = (async () => {
      (await getSqliteDb()).exec(`CREATE TABLE IF NOT EXISTS service_requests (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        requester_id TEXT,
        requester_name TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'request',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    })();
  }
  return schemaReady;
}

function fromSqliteRow(row: Record<string, unknown>): ServiceRequestRow {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    requesterId: (row.requester_id as string) ?? null,
    requesterName: row.requester_name as string,
    type: row.type as RequestType,
    priority: row.priority as RequestPriority,
    status: row.status as RequestStatus,
    title: row.title as string,
    description: row.description as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listServiceRequests(orgId: string, serviceId?: string): Promise<ServiceRequestRow[]> {
  await ensureSchema();
  const cols = `id, service_id AS "serviceId", requester_id AS "requesterId", requester_name AS "requesterName",
                  type, priority, status, title, description,
                  created_at AS "createdAt", updated_at AS "updatedAt"`;
  if (IS_POSTGRES) {
    const res = serviceId
      ? await (await getPgPool()).query(
          `SELECT ${cols} FROM service_requests WHERE org_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
          [orgId, serviceId]
        )
      : await (await getPgPool()).query(
          `SELECT ${cols} FROM service_requests WHERE org_id = $1 ORDER BY created_at DESC`,
          [orgId]
        );
    return res.rows;
  }
  const db = await getSqliteDb();
  const rows = serviceId
    ? db.prepare(`SELECT * FROM service_requests WHERE org_id = ? AND service_id = ? ORDER BY created_at DESC`).all(orgId, serviceId)
    : db.prepare(`SELECT * FROM service_requests WHERE org_id = ? ORDER BY created_at DESC`).all(orgId);
  return (rows as Record<string, unknown>[]).map(fromSqliteRow);
}

export async function createServiceRequest(orgId: string, input: NewServiceRequest): Promise<ServiceRequestRow> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const requesterId = input.requesterId ?? null;
  const requesterName = input.requesterName ?? "";
  const type = input.type ?? "request";
  const priority = input.priority ?? "medium";
  const description = input.description ?? "";

  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `INSERT INTO service_requests (id, org_id, service_id, requester_id, requester_name, type, priority, status, title, description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,$10,$10)`,
      [id, orgId, input.serviceId, requesterId, requesterName, type, priority, input.title, description, now]
    );
  } else {
    (await getSqliteDb())
      .prepare(
        `INSERT INTO service_requests (id, org_id, service_id, requester_id, requester_name, type, priority, status, title, description, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'open',?,?,?,?)`
      )
      .run(id, orgId, input.serviceId, requesterId, requesterName, type, priority, input.title, description, now, now);
  }

  return {
    id,
    serviceId: input.serviceId,
    requesterId,
    requesterName,
    type,
    priority,
    status: "open",
    title: input.title,
    description,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getServiceRequestServiceId(orgId: string, id: string): Promise<string | null> {
  await ensureSchema();
  if (IS_POSTGRES) {
    const res = await (await getPgPool()).query(
      `SELECT service_id AS "serviceId" FROM service_requests WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    return res.rows[0]?.serviceId ?? null;
  }
  const row = (await getSqliteDb())
    .prepare(`SELECT service_id FROM service_requests WHERE org_id = ? AND id = ?`)
    .get(orgId, id) as { service_id: string } | undefined;
  return row?.service_id ?? null;
}

export async function updateServiceRequestStatus(orgId: string, id: string, status: RequestStatus): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (IS_POSTGRES) {
    await (await getPgPool()).query(
      `UPDATE service_requests SET status = $1, updated_at = $2 WHERE org_id = $3 AND id = $4`,
      [status, now, orgId, id]
    );
  } else {
    (await getSqliteDb())
      .prepare(`UPDATE service_requests SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(status, now, orgId, id);
  }
}

// Exported so lib/rollups.ts can force this table into existence on the
// local SQLite driver before running a raw aggregation query against it
// directly (ensureSchema() above is otherwise only ever called lazily,
// from this module's own read/write functions). No-op on Postgres, where
// the migrations own the schema.
export function ensureServiceRequestsSchema(): Promise<void> {
  return ensureSchema();
}
