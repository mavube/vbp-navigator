-- Phase C (Track 2 — NavigatorOS Operating Model Refinement, portfolio
-- correction): the schema-anchor step flagged as a pause point in
-- claude/vbp-navigator-os-v3-build-sequence.md, run after Diallo's
-- explicit sign-off ("go", 2026-09-18).
--
-- What this migration deliberately does NOT do: it does not touch,
-- rename, or drop any existing `service_id` column anywhere in the
-- schema. Every entity that references `services` (the internal
-- Service & Value Architecture — the 10-row PMP delivery chain plus
-- enabling services) keeps that reference, unchanged, with its
-- existing meaning: "which internal capability/team owns this record
-- for permission purposes." That is a deliberate, additive design
-- choice, not a shortcut — see
-- claude/vbp-navigator-os-portfolio-correction-assessment.md for the
-- full reasoning. Rewriting nine tables' worth of foreign keys and
-- every permission check that reads them, in one pass, against
-- production data, was judged too risky for what it would buy today.
-- The actual reported bug — PMP vocabulary and PMP-only assumptions
-- leaking into code that's supposed to be offering-neutral — is a
-- narrower, separately fixable problem, picked up in Phase D onward.
--
-- What this migration DOES do: add a second, optional anchor —
-- `product_service_id`, a nullable reference into the Products &
-- Services Catalog (`price_catalog_items`, built Phase 16) — to every
-- entity in the customer-facing chain that can meaningfully be "about"
-- one of GDC's real, sellable offerings: a Prospect's public
-- application, a Lead in the pipeline, the Engagement a Lead becomes
-- on admission, and a scheduled Class. `service_id` keeps answering
-- "who internally handles this"; `product_service_id` now answers
-- "what is this customer actually buying" — two different questions
-- that used to be conflated into one column, now two separate ones.
--
-- Nullable and completely unenforced on purpose. Existing rows get no
-- value backfilled — there is nothing real to backfill them with, since
-- the catalog still ships empty (Truth Mode: no invented offerings)
-- until Diallo enters GDC's actual portfolio. No code path requires a
-- product_service_id going forward either. A lead, class, or prospect
-- with no product_service_id behaves exactly as it did before this
-- migration — this is additive, not a breaking change.
alter table leads add column if not exists product_service_id uuid references price_catalog_items (id) on delete set null;
create index if not exists leads_product_service_id_idx on leads (product_service_id);

alter table prospects add column if not exists product_service_id uuid references price_catalog_items (id) on delete set null;
create index if not exists prospects_product_service_id_idx on prospects (product_service_id);

alter table engagements add column if not exists product_service_id uuid references price_catalog_items (id) on delete set null;
create index if not exists engagements_product_service_id_idx on engagements (product_service_id);

alter table classes add column if not exists product_service_id uuid references price_catalog_items (id) on delete set null;
create index if not exists classes_product_service_id_idx on classes (product_service_id);
