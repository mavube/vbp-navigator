-- Phase 6: Work Views + Blocker Intelligence (v3.0 roadmap, §10-11).
--
-- Two additive changes, no rewrite of anything existing:
--
-- 1. `tasks.start_date` — the one new column Gantt needs. `due_date`
--    already existed since Phase 2; Gantt needs a start too. Nullable,
--    like due_date already is — a task with no dates still works fine
--    in List/Kanban, and the Gantt view (components/tasks/TaskGantt.tsx)
--    groups undated tasks into their own "no dates set" list rather
--    than fabricating a start.
--
-- 2. `blockers` — first-class, traceable objects per §11, instead of
--    inferring "blocked" from task status/dependencies alone. Requires
--    service_id (the core discipline, same as every other work-item
--    table) and optionally references the one task it's blocking.
--    owner_name/required_action/impact are the three fields the roadmap
--    itself names; denormalized owner_name follows the same pattern as
--    tasks.assignee_name/service_requests.requester_name rather than a
--    real FK, since there's still no person-picker UI anywhere in the
--    app (noted as a carried-forward gap since Phase 1).

alter table tasks add column if not exists start_date date;

create table if not exists blockers (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  service_id        uuid not null references services (id) on delete cascade,
  task_id           uuid references tasks (id) on delete set null,
  title             text not null,
  description       text not null default '',
  owner_name        text not null default '',
  impact            text not null default 'medium' check (impact in ('low', 'medium', 'high', 'critical')),
  required_action   text not null default '',
  status            text not null default 'open' check (status in ('open', 'resolved')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists blockers_org_id_idx on blockers (org_id);
create index if not exists blockers_service_id_idx on blockers (service_id);
create index if not exists blockers_task_id_idx on blockers (task_id);

alter table blockers enable row level security;

-- Same shape as Tasks: visible org-wide, open to report (anyone hitting
-- a blocker should be able to log it, same as anyone can log a task),
-- resolving restricted to that service's owner/contributor or an org
-- admin — the people actually positioned to unblock it, not whoever
-- happened to report it.
create policy blockers_select on blockers
  for select using (org_id = current_org_id());
create policy blockers_insert on blockers
  for insert with check (org_id = current_org_id());
create policy blockers_update on blockers
  for update using (
    org_id = current_org_id()
    and (
      has_role('org_admin')
      or has_role('service_owner', service_id)
      or has_role('contributor', service_id)
    )
  );
