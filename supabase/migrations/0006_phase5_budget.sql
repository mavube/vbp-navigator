-- Phase 5a: Budget — requests, quotations, expenses, and invoices
-- (both directions). Per the alignment doc Section 6: anyone can
-- initiate a Budget Request; it routes to the org's single org-wide
-- Budget Approver (Anne at VBP, role `budget_approver` with no
-- service_id — see has_role() in 0002); once spent it becomes an
-- Expense; incoming Invoices reconcile against an Expense, outgoing
-- Invoices bill a customer against a Class/Lead with no approval step.
--
-- Every one of these carries a required service_id — the core
-- discipline from the alignment doc Section 2 names budget items and
-- invoices explicitly, not just tasks/leads/classes. Quotation is the
-- one exception: it's a sub-record of a Budget Request, which already
-- carries the service_id it belongs to.

create table if not exists budget_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  service_id        uuid not null references services (id) on delete cascade,
  initiator_id      uuid references profiles (id) on delete set null,
  source            text not null check (source in ('petty_cash', 'direct')),
  purpose           text not null,
  amount            numeric(14,2) not null check (amount >= 0),
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_id       uuid references profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists budget_requests_org_id_idx on budget_requests (org_id);
create index if not exists budget_requests_service_id_idx on budget_requests (service_id);

create table if not exists quotations (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  budget_request_id   uuid not null references budget_requests (id) on delete cascade,
  vendor              text not null,
  amount              numeric(14,2) not null check (amount >= 0),
  created_at          timestamptz not null default now()
);
create index if not exists quotations_budget_request_id_idx on quotations (budget_request_id);

create table if not exists expenses (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  service_id          uuid not null references services (id) on delete cascade,
  budget_request_id   uuid references budget_requests (id) on delete set null,
  amount              numeric(14,2) not null check (amount >= 0),
  expense_date        date not null default current_date,
  description         text not null default '',
  receipt_url         text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists expenses_org_id_idx on expenses (org_id);
create index if not exists expenses_service_id_idx on expenses (service_id);

create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  service_id    uuid not null references services (id) on delete cascade,
  expense_id    uuid references expenses (id) on delete set null,
  class_id      uuid references classes (id) on delete set null,
  lead_id       uuid references leads (id) on delete set null,
  direction     text not null check (direction in ('incoming', 'outgoing')),
  party         text not null,
  amount        numeric(14,2) not null check (amount >= 0),
  due_date      date,
  status        text not null default 'unpaid' check (status in ('unpaid', 'paid', 'overdue')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists invoices_org_id_idx on invoices (org_id);
create index if not exists invoices_service_id_idx on invoices (service_id);

alter table budget_requests enable row level security;
alter table quotations enable row level security;
alter table expenses enable row level security;
alter table invoices enable row level security;

-- budget_requests: visible org-wide; anyone in the org can initiate one
-- (matches Tasks/Leads/Classes' open-creation rule); only the org-wide
-- Budget Approver or an Org Admin can approve/reject — see
-- app/api/budget-requests/[id]/route.ts, which enforces the same rule
-- in application code since it connects via DATABASE_URL, not a
-- per-user Supabase session (this RLS policy is the second line of
-- defense, same pattern as tasks/leads/classes).
create policy budget_requests_select on budget_requests
  for select using (org_id = current_org_id());
create policy budget_requests_insert on budget_requests
  for insert with check (org_id = current_org_id());
create policy budget_requests_update on budget_requests
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('budget_approver'))
  );

-- quotations: visible org-wide; adding one requires managing the
-- underlying budget request's service (Jennifer, as a Service Owner,
-- typically prepares these — see alignment doc Section 6) or approval
-- authority.
create policy quotations_select on quotations
  for select using (org_id = current_org_id());
create policy quotations_insert on quotations
  for insert with check (
    org_id = current_org_id()
    and exists (
      select 1 from budget_requests br
      where br.id = budget_request_id
        and (has_role('org_admin') or has_role('service_owner', br.service_id) or has_role('contributor', br.service_id) or has_role('budget_approver'))
    )
  );

-- expenses: recording actual spend is restricted to that service's
-- owner/contributor or an org admin — a real cash outlay, not an open
-- request like a Task or a Budget Request.
create policy expenses_select on expenses
  for select using (org_id = current_org_id());
create policy expenses_insert on expenses
  for insert with check (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );

-- invoices: same gate as expenses for both directions — Jennifer (as a
-- Service Owner) creates these per the alignment doc; outgoing invoices
-- still need no separate approval chain, they just need someone
-- authorized on the service to issue them.
create policy invoices_select on invoices
  for select using (org_id = current_org_id());
create policy invoices_insert on invoices
  for insert with check (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
create policy invoices_update on invoices
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
