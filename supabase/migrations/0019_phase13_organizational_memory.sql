-- v3.0 roadmap — Phase 9 (Organizational Memory, §17), built as this
-- project's own sequential Phase 13. "Decision/lesson capture ...
-- feeding directly into what the AI layer built in Phase 8 can surface
-- as historical pattern-matching" — the roadmap's own one-line scope.
-- Findings tracking (lib/findings-data.ts) was the closest existing
-- piece but is narrow — 4 fixed, hand-written findings, not a general
-- log anyone in the org can add to. This is that general log.
--
-- Two tables:
--
-- org_memory — the decision/lesson entries themselves. Same
-- polymorphic-adjacent shape as `comments` (0009) but purpose-built
-- rather than attached to a specific entity: `service_id` is nullable
-- because a real entry (e.g. the provider-concentration finding
-- already tracked by hand in the alignment doc) is often org-wide, not
-- about one service. `type` is a small, closed vocabulary — the
-- roadmap's own words, "decision" and "lesson" — not open text, so the
-- AI layer's prompt can reason about the two differently rather than
-- getting an unbounded label set.
create table if not exists org_memory (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  type          text not null default 'lesson',
  title         text not null,
  body          text not null default '',
  service_id    uuid references services (id) on delete set null,
  author_id     uuid references profiles (id) on delete set null,
  author_name   text not null default '',
  created_at    timestamptz not null default now()
);
alter table org_memory drop constraint if exists org_memory_type_check;
alter table org_memory add constraint org_memory_type_check
  check (type in ('decision', 'lesson'));
create index if not exists org_memory_org_id_idx on org_memory (org_id);
create index if not exists org_memory_service_id_idx on org_memory (org_id, service_id);

alter table org_memory enable row level security;

-- Visible org-wide; anyone in the org can add an entry — same
-- low-stakes, contextual bar as `comments` (0009), not a controlled
-- record like an Expense or Budget Request. No update/delete policy
-- yet, same carried-forward gap comments has.
create policy org_memory_select on org_memory
  for select using (org_id = current_org_id());
create policy org_memory_insert on org_memory
  for insert with check (org_id = current_org_id());

-- org_kpi_snapshots — one row per org per calendar day, captured
-- opportunistically (no cron in this app — see build guide's repeated
-- "no auto-anything" instinct) the first time the Dashboard or Advisor
-- is loaded that day. This is what finally gives the AI layer
-- (lib/ai-context.ts) something real to diff against for "this got
-- worse this week" instead of the trend field Phase 12 (Cluster E)
-- deliberately left out for exactly this reason. Columns mirror
-- lib/rollups.ts's OrgKpiSummary (the org-wide, all-fiscal-year
-- reading — same scope the Advisor already sees, not FY-filtered).
create table if not exists org_kpi_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organizations (id) on delete cascade,
  snapshot_date               date not null,
  active_work                 integer not null default 0,
  revenue_outgoing_total      numeric not null default 0,
  revenue_collected_total     numeric not null default 0,
  cost_total                  numeric not null default 0,
  net_total                   numeric not null default 0,
  services_healthy            integer not null default 0,
  services_attention          integer not null default 0,
  services_at_risk            integer not null default 0,
  blockers_high_impact_open   integer not null default 0,
  tasks_overdue               integer not null default 0,
  created_at                  timestamptz not null default now(),
  unique (org_id, snapshot_date)
);
create index if not exists org_kpi_snapshots_org_id_idx on org_kpi_snapshots (org_id, snapshot_date desc);

alter table org_kpi_snapshots enable row level security;

-- Same org-wide visibility as everything else; insert is effectively
-- system-captured (the app writes it on a normal page load, not a
-- user-authored action) but still gated to the caller's own org, same
-- shape as every other insert policy in this schema — there is no
-- separate service-role/background-job identity in this app.
create policy org_kpi_snapshots_select on org_kpi_snapshots
  for select using (org_id = current_org_id());
create policy org_kpi_snapshots_insert on org_kpi_snapshots
  for insert with check (org_id = current_org_id());
