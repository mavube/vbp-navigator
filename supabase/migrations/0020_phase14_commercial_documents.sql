-- Phase 14: Production Readiness — Commercial Documents, Company
-- Settings, Email Audit Trail (Diallo's Truth Mode directive, Area 1).
--
-- Three things, in one migration because they're one connected change:
--
-- 1. `documents` grows real commercial capability. 'proposal' and
--    'quotation' were, until now, plain templated letters (Phase 5) —
--    no price, no payment, no real lifecycle. That was never
--    production-grade: a real proposal or quotation always carries a
--    price. Rather than build a second, parallel "Proposal" concept
--    (which is exactly the duplicate-entry problem the directive calls
--    out), this upgrades 'proposal'/'quotation' in place and adds a new
--    'invoice' doc_type alongside them. Those three become "commercial
--    documents": money-bearing, chainable (a Quotation can be converted
--    from a Proposal, an Invoice from a Quotation — parent_document_id
--    — inheriting fields instead of re-typing them), and independently
--    startable (Diallo: "not every transaction starts with a
--    proposal... some start directly with an invoice" — a phone/email
--    order). The other five doc_types (invitation, approval_request,
--    confirmation, admission_communication, completion_record) are
--    untouched — still plain letters, still anchored to a lead or
--    engagement, still the four-state draft/pending_approval/approved/
--    rejected status they've always had.
--
--    The anchor rule loosens only for the three commercial types: they
--    may anchor to a lead, an engagement, a customer directly, or none
--    of the three (the phone-order case — recipient name/email typed
--    by hand). Enforced in the API route (same "route checks, lib
--    persists" split as everywhere else in this table), not in SQL,
--    because a per-doc_type conditional requirement isn't expressible
--    as a simple CHECK without a trigger — see documents_anchor_check
--    below for what SQL *does* still enforce.
--
--    Status grows eight values for commercial documents specifically:
--    draft -> generated -> under_review -> approved -> issued -> sent
--    -> delivered -> acknowledged. 'delivered'/'acknowledged' are real
--    columns and real states, but nothing in this phase sets them
--    automatically for proposal/quotation — that needs a Mailtrap
--    delivery webhook this phase doesn't build (see the build's own
--    README "Not done yet"). For 'invoice', 'acknowledged' *is* wired:
--    it's set the moment DPO's verifyToken confirms payment, because a
--    completed payment is real, unambiguous evidence the customer saw
--    and accepted the document — never fabricated, always a genuine
--    external signal.
--
-- 2. `org_settings` — the legal identity a real invoice has to carry
--    (registered name, TIN, address, bank details, VAT status) plus the
--    non-secret half of the Turnstile/Mailtrap configuration. One row
--    per org, editable only by an Org Admin. This is what the directive
--    means by "no hardcoded business logic" — these details were never
--    going to be right baked into template code, and now they aren't.
--    The Turnstile *secret* key and the Mailtrap *API token* are not
--    here — see .env.example — because a server-side secret used to
--    verify third-party callbacks belongs in an environment variable,
--    not a database row a UI can read back.
--
-- 3. `email_log` — every real email this app sends (a commercial
--    document delivered via Mailtrap) gets one row here: who, what,
--    when, the provider's own message id if it gave one, and whether it
--    actually succeeded. This is the audit trail the directive requires
--    before this app is allowed to claim a document was "sent" — a
--    claim now backed by a provider response, not a checkbox.

alter table documents
  drop constraint if exists documents_doc_type_check;
alter table documents
  add constraint documents_doc_type_check check (doc_type in (
    'proposal', 'quotation', 'invoice', 'invitation', 'approval_request',
    'confirmation', 'admission_communication', 'completion_record'
  ));

alter table documents
  drop constraint if exists documents_status_check;
alter table documents
  add constraint documents_status_check check (status in (
    'draft', 'pending_approval', 'approved', 'rejected',
    'generated', 'under_review', 'issued', 'sent', 'delivered', 'acknowledged'
  ));

-- The old anchor_check demanded lead_id or engagement_id for every
-- document. Commercial types are now allowed to have neither (a
-- standalone invoice) or a customer_id instead — the API still requires
-- *some* real recipient (name + email, either typed or anchor-derived)
-- before it will create one; SQL only guarantees a non-commercial
-- (letter-type) document still can't exist with no anchor at all.
alter table documents
  drop constraint if exists documents_anchor_check;
alter table documents
  add constraint documents_anchor_check check (
    doc_type in ('proposal', 'quotation', 'invoice')
    or lead_id is not null or engagement_id is not null
  );

alter table documents add column if not exists parent_document_id uuid references documents (id) on delete set null;
alter table documents add column if not exists amount numeric(14, 2);
alter table documents add column if not exists currency text not null default 'TZS';
alter table documents add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table documents add column if not exists due_date date;
alter table documents add column if not exists payment_status text not null default 'not_applicable';
alter table documents
  drop constraint if exists documents_payment_status_check;
alter table documents
  add constraint documents_payment_status_check check (payment_status in ('not_applicable', 'unpaid', 'paid', 'failed', 'refunded'));
alter table documents add column if not exists dpo_trans_token text;
alter table documents add column if not exists dpo_trans_ref text;
alter table documents add column if not exists dpo_company_ref text;
alter table documents add column if not exists paid_at timestamptz;
alter table documents add column if not exists access_token text;
alter table documents add column if not exists issued_at timestamptz;
alter table documents add column if not exists delivered_at timestamptz;
alter table documents add column if not exists acknowledged_at timestamptz;
alter table documents add column if not exists issued_by_name text not null default '';
alter table documents add column if not exists document_number text;

create unique index if not exists documents_access_token_idx on documents (access_token) where access_token is not null;
create index if not exists documents_parent_document_id_idx on documents (parent_document_id);
create index if not exists documents_customer_id_idx on documents (customer_id);

create table if not exists org_settings (
  org_id                uuid primary key references organizations (id) on delete cascade,
  legal_name            text not null default '',
  registration_number   text not null default '',
  tin                   text not null default '',
  address               text not null default '',
  bank_name             text not null default '',
  bank_account_name     text not null default '',
  bank_account_number   text not null default '',
  bank_branch           text not null default '',
  vat_registered        boolean not null default false,
  vat_number            text not null default '',
  vat_rate              numeric(5, 2) not null default 0,
  default_currency      text not null default 'TZS',
  payment_terms_text    text not null default '',
  turnstile_site_key    text not null default '',
  mailtrap_from_email   text not null default '',
  mailtrap_from_name    text not null default '',
  updated_by_name       text not null default '',
  updated_at            timestamptz not null default now()
);

alter table org_settings enable row level security;

create policy org_settings_select on org_settings
  for select using (org_id = current_org_id());
create policy org_settings_insert on org_settings
  for insert with check (org_id = current_org_id() and has_role('org_admin'));
create policy org_settings_update on org_settings
  for update using (org_id = current_org_id() and has_role('org_admin'));

create table if not exists email_log (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations (id) on delete cascade,
  document_id           uuid references documents (id) on delete set null,
  to_email              text not null,
  subject               text not null,
  provider              text not null default 'mailtrap',
  provider_message_id   text,
  status                text not null check (status in ('sent', 'failed')),
  error_message         text,
  sent_by_name          text not null default '',
  created_at            timestamptz not null default now()
);
create index if not exists email_log_org_id_idx on email_log (org_id);
create index if not exists email_log_document_id_idx on email_log (document_id);

alter table email_log enable row level security;

-- Same org-wide-select, gated-insert shape as `documents` itself — an
-- email is sent as a side effect of managing a document, so the same
-- people who can manage the underlying document's service can log one.
create policy email_log_select on email_log
  for select using (org_id = current_org_id());
create policy email_log_insert on email_log
  for insert with check (org_id = current_org_id());
