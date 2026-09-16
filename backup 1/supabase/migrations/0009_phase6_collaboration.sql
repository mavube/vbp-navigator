-- Phase 6b: Collaboration — a single polymorphic comment/activity table
-- that attaches to any entity (`entity_type` + `entity_id`), per the
-- alignment doc Section 5 ("Comments/mentions/activity, contextual").
-- Deliberately not a separate chat product — see the vision doc's
-- "collaboration lives where the work is" framing. `entity_id` is not
-- a foreign key: it points at whichever table `entity_type` names
-- (task/lead/class/budget_request/service_request/...), and Postgres
-- can't express a polymorphic FK — the application only ever writes an
-- id it just fetched from one of those tables, so this is the same
-- trade-off ITSM/ticketing tools make for activity feeds generally.
--
-- `author_name` is denormalized (captured at post time) rather than
-- always joined from `profiles`, so a comment's byline survives even
-- if the author's profile is later removed — same reasoning as
-- `compensation_entries.employee_name`.

create table if not exists comments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid not null,
  author_id     uuid references profiles (id) on delete set null,
  author_name   text not null default '',
  body          text not null,
  mentions      text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists comments_org_id_idx on comments (org_id);
create index if not exists comments_entity_idx on comments (org_id, entity_type, entity_id);

alter table comments enable row level security;

-- Visible org-wide; anyone in the org can post one — comments are
-- low-stakes and contextual, not a controlled record like an Expense.
-- No update/delete policy yet (see build guide's Phase 6 follow-ups).
create policy comments_select on comments
  for select using (org_id = current_org_id());
create policy comments_insert on comments
  for insert with check (org_id = current_org_id());
