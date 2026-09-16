-- Phase 4: Customer, Engagement & Public Entry Point (v3.0 roadmap).
--
-- Implements the confirmed decision from vbp-navigator-os-v3-roadmap.md:
-- new unauthenticated public routes (/apply, /assess) write a
-- `prospects` row; staff review it from the new /prospects page and
-- promote it into the EXISTING `leads` table — no new pipeline/stage
-- machinery, Leads already owns new/contacted/assessed/admitted/lost.
-- When a lead reaches its existing 'admitted' stage (app/api/leads/
-- [id]/route.ts), the app finds-or-creates a `customers` row (matched
-- by email within the org) and creates a linked `engagements` row —
-- this is the "converts into a full customer record on admission"
-- behavior the roadmap names, and it's what gives the brief's own
-- Customer -> Situation -> Service -> Engagement -> Outcome chain (§2-3)
-- real, distinct entities for the first time, without duplicating
-- Leads' own pipeline logic. Document generation against Engagement
-- (§8) is explicitly Phase 5's job, not this one's.

create table if not exists prospects (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  service_id          uuid references services (id) on delete set null,
  source              text not null default 'apply' check (source in ('apply', 'assessment')),
  full_name           text not null,
  email               text not null default '',
  phone               text not null default '',
  message             text not null default '',
  assessment_answers  jsonb not null default '{}',
  status              text not null default 'new' check (status in ('new', 'reviewed', 'promoted', 'declined')),
  lead_id             uuid references leads (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists prospects_org_id_idx on prospects (org_id);
create index if not exists prospects_service_id_idx on prospects (service_id);

create table if not exists customers (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  full_name           text not null,
  email               text not null default '',
  phone               text not null default '',
  organization_name   text not null default '',
  source_lead_id      uuid references leads (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists customers_org_id_idx on customers (org_id);
-- Partial unique index (email != '') rather than a plain unique
-- constraint — leads/prospects with no email on file are common (phone-
-- only contact) and shouldn't collide with each other as "duplicate
-- customers" just because they all share an empty string.
create unique index if not exists customers_org_email_idx on customers (org_id, email) where email != '';

create table if not exists engagements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  customer_id   uuid not null references customers (id) on delete cascade,
  service_id    uuid not null references services (id) on delete cascade,
  lead_id       uuid references leads (id) on delete set null,
  status        text not null default 'active' check (status in ('active', 'completed', 'paused')),
  started_at    timestamptz not null default now(),
  outcome_note  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists engagements_org_id_idx on engagements (org_id);
create index if not exists engagements_customer_id_idx on engagements (customer_id);
create index if not exists engagements_service_id_idx on engagements (service_id);

alter table prospects enable row level security;
alter table customers enable row level security;
alter table engagements enable row level security;

-- prospects: this app's own server routes write via DATABASE_URL, not a
-- per-user Supabase session (see lib/db-driver.ts's RLS note — same
-- everywhere else in this app), so this policy is defense-in-depth, not
-- the real gate for /apply and /assess. The real gate is that
-- app/api/public/org/[slug]/prospects/route.ts is the only thing that
-- ever calls createProspect(), and it resolves org_id itself from the
-- org's public slug rather than trusting a client-supplied id.
create policy prospects_insert_public on prospects
  for insert to anon with check (true);
create policy prospects_select on prospects
  for select using (org_id = current_org_id());
create policy prospects_update on prospects
  for update using (org_id = current_org_id());

-- customers/engagements: same org-wide-visible, staff-managed pattern as
-- leads (0004) — anyone in the org can view; writing requires being on
-- the relevant service or an org admin. Customers/engagements are only
-- ever created by the app's own admission-conversion code path (see
-- lib/db-engagements.ts), never directly by a form, so there's no
-- separate "anyone can create" insert policy the way leads/tasks have.
create policy customers_select on customers
  for select using (org_id = current_org_id());
create policy customers_insert on customers
  for insert with check (org_id = current_org_id());
create policy customers_update on customers
  for update using (org_id = current_org_id());

create policy engagements_select on engagements
  for select using (org_id = current_org_id());
create policy engagements_insert on engagements
  for insert with check (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
create policy engagements_update on engagements
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
