-- Phase 2: Processes (Tasks) — the first v2.0 feature module. Every task
-- requires a serviceId (the core discipline from the alignment doc
-- Section 2) — there is deliberately no "unassigned to any service"
-- state.

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  service_id    uuid not null references services (id) on delete cascade,
  title         text not null,
  description   text not null default '',
  status        text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  assignee_id   uuid references profiles (id) on delete set null,
  due_date      date,
  dependencies  uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_org_id_idx on tasks (org_id);
create index if not exists tasks_service_id_idx on tasks (service_id);

alter table tasks enable row level security;

-- Visible org-wide. Any org member can create a task (matches how a real
-- team actually logs work) — but only org_admin, that service's Service
-- Owner/Contributor, or the task's own assignee can update it. See
-- lib/db-driver.ts's note: this policy is a second line of defense for
-- any Supabase-client code path — the API routes in app/api/tasks/
-- re-check the same rule in application code, since they connect via
-- DATABASE_URL rather than a per-user Supabase session.
create policy tasks_select on tasks
  for select using (org_id = current_org_id());
create policy tasks_insert on tasks
  for insert with check (org_id = current_org_id());
create policy tasks_update on tasks
  for update using (
    org_id = current_org_id()
    and (
      has_role('org_admin')
      or has_role('service_owner', service_id)
      or has_role('contributor', service_id)
      or assignee_id = auth.uid()
    )
  );
