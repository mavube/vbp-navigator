-- Phase 16: Products & Services Catalog (portfolio correction, part 1
-- of the "NavigatorOS Operating Model Refinement" brief, 2026-09-18).
--
-- The brief's core correction: GDC is not a PMP-only business — PMP is
-- one offering in a real portfolio (MS Project Training, AI for
-- Business, ValueBlueprint(R) Advisory, ICT Systems Advisory, and more).
-- The app's only "services" concept until now (the `services` table)
-- is actually VBP's *internal* Service & Value Architecture — the 5
-- CVS + 5 Enabling Services describing how VBP delivers PMP internally
-- — and it has been overloaded as the commercial anchor every Lead,
-- Customer, Engagement, Task, Class, and Document points to. That's
-- the root cause of the PMP leakage documented in this session's
-- portfolio-correction assessment.
--
-- This migration does NOT touch `services` (it stays exactly as-is,
-- narrowed in role to internal-only, feeding Architecture/Capabilities/
-- Compensation). It extends `price_catalog_items` instead — built two
-- phases ago (0021) as a deliberately separate table from `services`,
-- which turns out to be exactly the right seed for a real Products &
-- Services Catalog: it already has org-scoped RLS, active/inactive,
-- and the pricing fields (unit_price/currency/tax_rate) the brief
-- still wants kept. What it's missing is everything that makes a row
-- an actual *offering definition* rather than just a billing line item
-- — the brief's own field list (SS3): category, type, target customer,
-- standard offering, delivery model, typical duration, what's
-- included, expected outcome, required capabilities, related
-- documents.
--
-- required_capabilities is a soft link (uuid[], no FK) into `services`
-- — "which internal CVS/Enabling services does delivering this product
-- actually require" — informational, not enforced, since a product's
-- required capabilities can legitimately reference a service that's
-- later renamed or removed without that being a data-integrity error
-- in the catalog itself.
--
-- No `product_service_id` column appears anywhere yet in this
-- migration — that's the anchor migration (leads/engagements/tasks/
-- classes/documents pointing here instead of at `services`), planned
-- as its own separate phase with its own sign-off, per the build
-- sequence doc, since it touches far more tables than this one does
-- and needs an explicit data-mapping decision for existing rows.

alter table price_catalog_items add column if not exists category text not null default '';
alter table price_catalog_items add column if not exists offering_type text not null default '';
alter table price_catalog_items add column if not exists target_customer text not null default '';
alter table price_catalog_items add column if not exists standard_offering text not null default '';
alter table price_catalog_items add column if not exists delivery_model text not null default '';
alter table price_catalog_items add column if not exists typical_duration text not null default '';
alter table price_catalog_items add column if not exists pricing_model text not null default '';
alter table price_catalog_items add column if not exists included text not null default '';
alter table price_catalog_items add column if not exists expected_outcome text not null default '';
alter table price_catalog_items add column if not exists required_capabilities uuid[] not null default '{}';
alter table price_catalog_items add column if not exists related_documents text not null default '';

create index if not exists price_catalog_items_category_idx on price_catalog_items (org_id, category);
