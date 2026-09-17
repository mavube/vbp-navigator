-- v3.0 roadmap — Phase 10: Business-grade forms (Cluster C).
--
-- Five schema additions backing the five items in
-- claude/vbp-navigator-os-v3-enhancement-backlog.md's Cluster C. Each
-- one is additive against tables that already carry real rows — no
-- backfill needed, same discipline as every migration since 0006.

-- 1. Invoices: optional structured line items. Kept as a JSONB array on
-- the invoice row itself (mirrors prospects.assessment_answers and
-- tasks.dependencies — a small, bounded, invoice-owned list, not a
-- relation that needs its own join/permission surface). When present,
-- the API computes `amount` as the sum of quantity*unitAmount rather
-- than trusting a client-sent total — see app/api/invoices/route.ts.
-- Existing flat-amount invoices keep working unchanged: an empty array
-- means "no line items," same as before this column existed.
alter table invoices add column if not exists line_items jsonb not null default '[]';

-- 2. Customers: no schema change needed. Create/edit both go through
-- the existing customers table and its existing partial-unique email
-- index (0012) — the same dedupe-by-email path lead admission already
-- uses (lib/db-customers.ts's findOrCreateCustomerByEmail) is reused
-- for the new manual "add customer" form, so this migration doesn't
-- touch this table at all.

-- 3. Prospects: widen the source check constraint to add 'manual' — a
-- prospect logged by staff directly (Cluster C's "log an inquiry"
-- form), alongside the existing public-intake sources 'apply' and
-- 'assessment'. The constraint was declared inline on the original
-- create table (0012), so it carries Postgres's default auto-generated
-- name for an inline check on this column.
alter table prospects drop constraint if exists prospects_source_check;
alter table prospects add constraint prospects_source_check
  check (source in ('apply', 'assessment', 'manual'));

-- 4. Classes: a real enrollment/roster entity — up to now "confirm
-- enrolled candidate list" was just a checklist line (STANDARD_SETUP_TASKS
-- in lib/db-classes.ts), with no actual link to which Customers are in
-- a class. That checklist task is left exactly as-is (it's a real,
-- separate to-do — "go confirm the list" — not the same thing as the
-- list itself existing in the system); this table is the list.
create table if not exists class_enrollments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  class_id     uuid not null references classes (id) on delete cascade,
  customer_id  uuid not null references customers (id) on delete cascade,
  status       text not null default 'enrolled' check (status in ('enrolled', 'waitlisted', 'withdrawn')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (class_id, customer_id)
);
create index if not exists class_enrollments_org_id_idx on class_enrollments (org_id);
create index if not exists class_enrollments_class_id_idx on class_enrollments (class_id);
create index if not exists class_enrollments_customer_id_idx on class_enrollments (customer_id);

alter table class_enrollments enable row level security;
-- Same "that service's owner/contributor or an org admin" gate as every
-- other write against a class's own data (setup tasks, status) — the
-- class's service_id is looked up via a join since class_enrollments
-- doesn't carry its own service_id column (would just be a denormalized
-- copy of classes.service_id with no independent meaning).
create policy class_enrollments_select on class_enrollments
  for select using (org_id = current_org_id());
create policy class_enrollments_insert on class_enrollments
  for insert with check (
    org_id = current_org_id()
    and exists (
      select 1 from classes c where c.id = class_id
        and (has_role('org_admin') or has_role('service_owner', c.service_id) or has_role('contributor', c.service_id))
    )
  );
create policy class_enrollments_update on class_enrollments
  for update using (
    org_id = current_org_id()
    and exists (
      select 1 from classes c where c.id = class_id
        and (has_role('org_admin') or has_role('service_owner', c.service_id) or has_role('contributor', c.service_id))
    )
  );

-- 5. Documents: an optional attachment link. Same "URL field, not real
-- file storage" pattern as expenses.receipt_url (0015) — this app has
-- no file storage backend wired up yet, and a plain link (to wherever
-- the file already lives — Drive, SharePoint, email) closes the actual
-- gap without standing up new storage infrastructure for it.
alter table documents add column if not exists attachment_url text not null default '';
