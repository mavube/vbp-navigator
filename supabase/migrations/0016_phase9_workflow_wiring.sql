-- Phase 9 (v3.0 enhancement backlog Cluster B — "Workflow wiring").
--
-- One additive column, no rewrite of anything existing:
--
-- `tasks.service_request_id` — the missing link the audit found:
-- Service Requests were completely isolated from every other module
-- (no other table referenced `service_request_id`), so there was no
-- way to spawn a Task from a request without manually recreating it
-- elsewhere and losing the connection back to the request that asked
-- for it. Nullable, `on delete set null` — same shape as the existing
-- `tasks.class_id` link to Classes (0005), not a new pattern.
--
-- Nothing else in this phase needs a schema change:
-- - Blocker → Task auto-unblock reads/writes columns that already exist.
-- - Class completion gating reads the existing tasks.class_id link.
-- - Class completion → Invoice reuses the existing invoices.class_id
--   column (added in 0006 specifically for this, per its own comment,
--   and never used until now).
-- - Service Health drill-down links are a response-shape change only
--   (lib/service-health.ts), not a schema change.
-- - Task dependency enforcement reads the existing tasks.dependencies
--   column (0003) — it was captured and stored from day one, just never
--   read anywhere until this phase, and (see lib/db-tasks.ts's history)
--   never actually settable from the UI either; both gaps close here.

alter table tasks add column if not exists service_request_id uuid references service_requests (id) on delete set null;
create index if not exists tasks_service_request_id_idx on tasks (service_request_id);
