-- Phase 4: Classes — instances of the Master Class Delivery chain.
-- Creating a class auto-generates a standard set of setup Tasks (see
-- lib/db-classes.ts's STANDARD_SETUP_TASKS) so the checklist from the
-- earlier v1.0 prototype survives, re-pointed at v2.0's serviceId model
-- instead of hardcoded departments. Same org/service-scoping shape as
-- tasks (0003) and leads (0004) — see those files' comments for the
-- reasoning, not repeated here.

create table if not exists classes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  service_id     uuid not null references services (id) on delete cascade,
  title          text not null,
  scheduled_date date,
  instructor_name text not null default '',
  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists classes_org_id_idx on classes (org_id);
create index if not exists classes_service_id_idx on classes (service_id);

alter table classes enable row level security;

create policy classes_select on classes
  for select using (org_id = current_org_id());
create policy classes_insert on classes
  for insert with check (org_id = current_org_id());
create policy classes_update on classes
  for update using (
    org_id = current_org_id()
    and (
      has_role('org_admin')
      or has_role('service_owner', service_id)
      or has_role('contributor', service_id)
    )
  );

-- A Task can optionally belong to the Class that generated it (the
-- setup checklist). Nullable — most tasks aren't tied to a class.
alter table tasks add column if not exists class_id uuid references classes (id) on delete set null;
create index if not exists tasks_class_id_idx on tasks (class_id);
