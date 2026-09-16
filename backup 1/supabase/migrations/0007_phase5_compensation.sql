-- Phase 5b: Compensation Earning Service — VBP's 5th Enabling Service,
-- real payroll computation rather than a category on Expense. Per the
-- alignment doc Section 7: Jennifer runs the monthly process (creates
-- draft entries), Anne approves (finalizes) as the org-wide Budget
-- Approver — same role used for ordinary Budget Requests. Statutory
-- rates are configurable per org (compensation_rate_configs), not
-- hardcoded — see lib/payroll.ts for the computation and its rates
-- caveat.

create table if not exists compensation_rate_configs (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null unique references organizations (id) on delete cascade,
  nssf_employee_rate    numeric(6,4) not null default 0.10,
  wcf_rate              numeric(6,4) not null default 0,
  paye_brackets         jsonb not null default '[
    {"upTo": 270000, "rate": 0},
    {"upTo": 520000, "rate": 0.08},
    {"upTo": 760000, "rate": 0.20},
    {"upTo": 1000000, "rate": 0.25},
    {"upTo": null, "rate": 0.30}
  ]'::jsonb,
  updated_at            timestamptz not null default now()
);

create table if not exists compensation_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  service_id      uuid not null references services (id) on delete cascade,
  employee_id     uuid references profiles (id) on delete set null,
  employee_name   text not null default '',
  period          text not null, -- 'YYYY-MM'
  basic_pay       numeric(14,2) not null check (basic_pay >= 0),
  allowances      jsonb not null default '[]',
  deductions      jsonb not null default '[]',
  net_pay         numeric(14,2) not null,
  status          text not null default 'draft' check (status in ('draft', 'finalized')),
  expense_id      uuid references expenses (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists compensation_entries_org_id_idx on compensation_entries (org_id);
create index if not exists compensation_entries_service_id_idx on compensation_entries (service_id);
create index if not exists compensation_entries_period_idx on compensation_entries (org_id, period);

alter table compensation_rate_configs enable row level security;
alter table compensation_entries enable row level security;

-- Rate config: visible org-wide (Service Owners should be able to see
-- what rates a computed entry used); only an Org Admin edits it, since
-- getting statutory rates wrong is an org-level policy decision, not a
-- day-to-day one.
create policy compensation_rate_configs_select on compensation_rate_configs
  for select using (org_id = current_org_id());
create policy compensation_rate_configs_write on compensation_rate_configs
  for all using (org_id = current_org_id() and has_role('org_admin'))
  with check (org_id = current_org_id() and has_role('org_admin'));

-- compensation_entries: visible org-wide; creating a draft entry
-- requires managing the Compensation Earning Service itself (Jennifer,
-- per Section 7) or Org Admin; finalizing (the approval step, which
-- also generates the linked Expense — see lib/db-compensation.ts) is
-- restricted to the org-wide Budget Approver or Org Admin, same gate as
-- approving a Budget Request.
create policy compensation_entries_select on compensation_entries
  for select using (org_id = current_org_id());
create policy compensation_entries_insert on compensation_entries
  for insert with check (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
create policy compensation_entries_update on compensation_entries
  for update using (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('budget_approver'))
  );
