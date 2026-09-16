-- v2.0 foundation RLS: turns org_id into a real boundary instead of a
-- column applications have to remember to filter by. Two helper
-- functions keep every policy below short.

-- The calling user's own org — SECURITY DEFINER so it can read `profiles`
-- without that read itself being blocked by profiles' own RLS policy
-- (which would otherwise recurse).
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Does the calling user hold `check_role`? Pass check_service_id to ask
-- about a specific service; leave it null to ask about an org-wide role
-- (org_admin, viewer, budget_approver) or "this role on any service".
create or replace function has_role(check_role app_role, check_service_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from role_assignments
    where user_id = auth.uid()
      and role = check_role
      and (check_service_id is null or service_id = check_service_id)
  )
$$;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table role_assignments enable row level security;
alter table services enable row level security;
alter table findings enable row level security;

-- organizations: a user can see their own org, nothing else.
create policy organizations_select on organizations
  for select using (id = current_org_id());

-- profiles: see everyone in your own org; only org_admin edits others.
create policy profiles_select on profiles
  for select using (org_id = current_org_id());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());
create policy profiles_update_admin on profiles
  for update using (org_id = current_org_id() and has_role('org_admin'));

-- role_assignments: visible org-wide, only org_admin changes them.
create policy role_assignments_select on role_assignments
  for select using (org_id = current_org_id());
create policy role_assignments_write on role_assignments
  for all using (org_id = current_org_id() and has_role('org_admin'))
  with check (org_id = current_org_id() and has_role('org_admin'));

-- services: visible org-wide; org_admin manages any service, a Service
-- Owner edits only the service(s) they own.
create policy services_select on services
  for select using (org_id = current_org_id());
create policy services_insert on services
  for insert with check (org_id = current_org_id() and has_role('org_admin'));
create policy services_update on services
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', id))
  );

-- findings: visible org-wide; org_admin or that finding's Service Owner
-- can update status/note.
create policy findings_select on findings
  for select using (org_id = current_org_id());
create policy findings_update on findings
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id))
  );
