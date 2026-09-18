-- Phase 15: Commercial Documents corrections (Diallo's "case 1" review
-- of the Phase 14 delivery) — two fixes, one migration:
--
-- 1. The generic conversion mechanism let a Proposal convert straight
--    into a Quotation or an Invoice. Diallo: "you can not convert a
--    proposal into a quotation nor an invoice but a quotation can be
--    converted to an invoice." A Proposal carries prose/narrative detail
--    that doesn't map onto an Invoice's structured line items the way a
--    Quotation's already-structured items do — so instead, "a proposal
--    when accepted should allow creating an invoice against the
--    accepted proposal." That's a *different*, narrower path: a staff
--    member marks a Proposal accepted (the customer said yes — by
--    phone, email, or a signed copy; this app has no public accept-link
--    page yet, so it's a manual attestation, same trust model as
--    mark_acknowledged), which unlocks creating a blank-line-item
--    Invoice against it. `accepted_at`/`accepted_by_name` are what
--    record that moment — real columns, not inferred from status,
--    because "accepted by the customer" and "approved internally"
--    (the existing `approved` status) are two different facts. The
--    conversion allow-list itself is enforced in the API route (same
--    "route checks, lib persists" split as everywhere else in this
--    table) — nothing here blocks it in SQL, since parent_document_id
--    already allows any doc_type -> doc_type link and a per-pair CHECK
--    isn't expressible without a trigger.
--
-- 2. Free-text line items ("add line item" = type a description,
--    quantity, and price by hand) become select-from-a-catalog:
--    "instead of having add line item, we should have predefined
--    services where add line item means select. preconfigure price tax
--    exluded so it is calculated after and per item." `price_catalog_items`
--    is a new, standalone catalog — deliberately NOT the existing
--    `services` table (the org's Service & Value Architecture / 5 CVS +
--    5 Enabling Services methodology catalog): a billable line item
--    (a workshop seat, a printed deliverable, a follow-up session) often
--    isn't 1:1 with one of those 10 named services, and pricing/tax
--    fields don't belong on a table that's really about methodology,
--    not money. `documents.line_items` (jsonb, already flexible) needs
--    no schema change to carry the new `catalogItemId`/`taxRate` fields
--    per item — the price and tax rate are snapshotted into the line
--    item at selection time, so a later catalog price change never
--    retroactively alters an already-created document, same principle
--    as `email_log` recording what actually happened rather than a live
--    join.

alter table documents add column if not exists accepted_at timestamptz;
alter table documents add column if not exists accepted_by_name text not null default '';

create table if not exists price_catalog_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  name              text not null,
  description       text not null default '',
  unit_price        numeric(12, 2) not null default 0,
  currency          text not null default 'TZS',
  -- null = "use the org's VAT rate at the moment this item is added to
  -- a document" (resolved and snapshotted client-side into the line
  -- item's own taxRate, same reasoning as the line item snapshot
  -- above); a real number here (including 0) overrides it per item,
  -- e.g. a zero-rated or VAT-exempt service.
  tax_rate          numeric(5, 2),
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_by_name   text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists price_catalog_items_org_id_idx on price_catalog_items (org_id);
create index if not exists price_catalog_items_active_idx on price_catalog_items (org_id, active);

alter table price_catalog_items enable row level security;

-- Same shape as org_settings: readable by anyone in the org (staff
-- building a Proposal/Quotation/Invoice need to see the price list),
-- writable only by an Org Admin (this is a pricing decision, same
-- authority level as Company Settings).
create policy price_catalog_items_select on price_catalog_items
  for select using (org_id = current_org_id());
create policy price_catalog_items_insert on price_catalog_items
  for insert with check (org_id = current_org_id() and has_role('org_admin'));
create policy price_catalog_items_update on price_catalog_items
  for update using (org_id = current_org_id() and has_role('org_admin'));
