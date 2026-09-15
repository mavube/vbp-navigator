-- Phase 6a: Service Requests — ITSM-style request/incident tracking.
-- Same shape and RLS pattern as tasks/leads/classes (see those files'
-- comments, not repeated here). Submitting one is open to anyone (the
-- alignment doc Section 4 makes Requester the default role for any
-- staff member); only that service's owner/contributor or an Org Admin
-- can move it through status.

create table if not exists service_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  service_id        uuid not null references services (id) on delete cascade,
  requester_id      uuid references profiles (id) on delete set null,
  requester_name    text not null default '',
  type              text not null default 'request' check (type in ('request', 'incident')),
  priority          text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status            text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  title             text not null,
  description       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists service_requests_org_id_idx on service_requests (org_id);
create index if not exists service_requests_service_id_idx on service_requests (service_id);

alter table service_requests enable row level security;

create policy service_requests_select on service_requests
  for select using (org_id = current_org_id());
create policy service_requests_insert on service_requests
  for insert with check (org_id = current_org_id());
create policy service_requests_update on service_requests
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
