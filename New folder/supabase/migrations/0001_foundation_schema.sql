-- v2.0 foundation schema: organizations, per-user profiles, role
-- assignments, and the Service/Finding tables retrofitted with org_id.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) against a
-- fresh or existing project. RLS policies live in the next migration file
-- so schema and access control stay easy to read separately.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tenants
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- One row per Supabase Auth user. A user belongs to exactly one
-- organization in v2.0 — multi-org membership per person is out of scope
-- for now (see the alignment doc if that ever needs revisiting).
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid not null references organizations (id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_org_id_idx on profiles (org_id);

-- --------------------------------------------------------------- roles
-- Org Admin, Viewer and Budget Approver are org-wide (service_id null).
-- Service Owner, Contributor and Requester are scoped to one service.
create type app_role as enum (
  'org_admin',
  'service_owner',
  'contributor',
  'requester',
  'budget_approver',
  'viewer'
);

create table if not exists role_assignments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  service_id  uuid, -- FK added below, once `services` exists (see the alter table further down)
  role        app_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, service_id, role)
);
create index if not exists role_assignments_org_id_idx on role_assignments (org_id);
create index if not exists role_assignments_user_id_idx on role_assignments (user_id);

-- ------------------------------------------------------------- services
-- Formalizes what v1.0 hardcoded as JSX (components/ServiceCards.tsx) into
-- a real, per-org table. `provider_id` / `backup_id` reference profiles
-- directly since a service has at most one primary provider and one
-- backup at a time — Contributor role assignments handle anyone else
-- working under the service.
create table if not exists services (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  type          text not null check (type in ('cvs', 'enabling')),
  name          text not null,
  recipient     text not null default '',
  outcome       text not null default '',
  technology    text not null default '',
  department    text not null default '',
  provider_id   uuid references profiles (id) on delete set null,
  backup_id     uuid references profiles (id) on delete set null,
  depends_on    uuid[] not null default '{}',
  feeds         uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists services_org_id_idx on services (org_id);

-- role_assignments.service_id references services, which didn't exist
-- yet when that table was created above — add the constraint now that
-- both tables exist.
alter table role_assignments
  add constraint role_assignments_service_id_fkey
  foreign key (service_id) references services (id) on delete cascade;

-- ------------------------------------------------------------- findings
-- v1.0 kept finding copy (title/body/severity) as static TS
-- (lib/findings-data.ts) and only persisted status/note, keyed by a
-- fixed id like "finding-1". That stays true for VBP's own four seeded
-- findings — but the key can no longer be the primary key once multiple
-- orgs exist, since every tenant would want to reuse "finding-1". `key`
-- is what the app code refers to; `id` + `unique (org_id, key)` make it
-- safe per-tenant.
create table if not exists findings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  service_id  uuid references services (id) on delete set null,
  key         text not null,
  status      text not null default 'open',
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  unique (org_id, key)
);
create index if not exists findings_org_id_idx on findings (org_id);
