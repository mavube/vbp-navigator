-- Phase 3: Pipeline (Leads) — tied to the two gap CVS (Professional
-- Readiness Assessment, Candidate Admission) per the alignment doc.
-- Same shape and RLS pattern as tasks (0003) — see that file's comments
-- for the reasoning, not repeated here.

create table if not exists leads (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  service_id     uuid not null references services (id) on delete cascade,
  contact_name   text not null,
  contact_email  text not null default '',
  contact_phone  text not null default '',
  stage          text not null default 'new'
                   check (stage in ('new', 'contacted', 'assessed', 'admitted', 'lost')),
  owner_id       uuid references profiles (id) on delete set null,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists leads_org_id_idx on leads (org_id);
create index if not exists leads_service_id_idx on leads (service_id);

alter table leads enable row level security;

create policy leads_select on leads
  for select using (org_id = current_org_id());
create policy leads_insert on leads
  for insert with check (org_id = current_org_id());
create policy leads_update on leads
  for update using (
    org_id = current_org_id()
    and (
      has_role('org_admin')
      or has_role('service_owner', service_id)
      or has_role('contributor', service_id)
      or owner_id = auth.uid()
    )
  );
