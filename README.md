# VBP Navigator OS — Phase 16: Products & Services Catalog

Track 2, Phase B of the "NavigatorOS Operating Model Refinement" correction — the first concrete build step toward fixing the PMP-only leakage documented in the portfolio-correction assessment. Full sequencing context is in the project docs (`vbp-navigator-os-portfolio-correction-assessment.md` and `vbp-navigator-os-v3-build-sequence.md`).

## What changed

The Phase 15 Price Catalog (a billing line-item picker — name, price, tax) is now the real **Products & Services Catalog** — what GDC actually offers, not just what a line item costs. No new table: `price_catalog_items` (already a separate table from the internal Service & Value Architecture `services` table, by design since Phase 15) gets 11 new columns matching the brief's own field list — category, type, target customer, standard offering, delivery model, typical duration, pricing model, what's included, expected outcome, required capabilities (a soft, unenforced reference to internal `services` — "which internal capability does delivering this draw on"), and related documents.

The Company Settings page for this (`/settings/price-catalog`) is relabeled **Products & Services Catalog** and reworked: the compact "name / price / tax" form staff already know still comes first, with an optional "Add offering details" section underneath for everything else — so entering a quick billable item stays quick, and defining a real offering is there when you need it. Each catalog card shows category/type badges at a glance and a "Details" toggle for the rest. Category is free text with datalist suggestions from the brief's own examples (Training & Capability Development, Business Transformation & ICT Advisory, etc.) — adding a new category is typing it, not a schema change.

**What this deliberately does NOT do yet**: nothing here changes what Leads/Customers/Engagements/Tasks/Documents anchor to — they still point at the internal `services` table. That's Phase C (the schema anchor migration) in the build sequence doc, and it's flagged there as its own checkpoint before I run it, since it touches far more tables at once and needs a data-mapping decision for GDC's existing records that you should see first.

**No fake data was seeded.** Per this project's Truth Mode discipline, the catalog ships empty in production — same as Phase 15's price catalog did. GDC's real offerings (PMP Master Class, and whichever others you want captured now) need to be entered by hand once this is live, with real prices and real offering details, not invented ones.

## Apply

1. Run the migration: `supabase/migrations/0022_phase16_products_services_catalog.sql` — 11 `alter table ... add column if not exists` statements against `price_catalog_items`, plus one new index. Additive only, nothing destructive, no data loss for existing catalog rows (their new fields just default to empty).
2. Copy the other files into the matching paths, overwriting what's there. One new file: `components/ui/Textarea.tsx` (a small multi-line wrapper, reused by the offering-detail fields — the first place in this app that needed real multi-line text entry).
3. `npm run build` to confirm, then deploy.
4. Once live, go to **Products & Services** (same URL as before: `/settings/price-catalog`) and start entering GDC's real portfolio — at minimum PMP Master Class, so the anchor migration in Phase C has a real row to map the existing PMP-shaped data onto.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **22 new assertions**: full offering-definition create/persist, minimal (Phase-15-shaped) create still works unchanged, list returns the new fields on every row, partial PATCH touches only the fields sent, required-capabilities can be set and cleared, and a Phase-15-era catalog item can be "upgraded" with the new fields later without losing anything.
- **Zero regressions**: Phase 14 (48 assertions) and Phase 15 (29 assertions) suites re-run clean against this build, each on a fresh database in isolation.
- Playwright screenshots at 1440px and 390px of the reworked `/settings/price-catalog` page — the expanded offering-details form, the required-capabilities chip picker (pulling live from the internal Service & Value Architecture), and the catalog list with category/type badges. No horizontal overflow at mobile width.
- Every file in this package diffed byte-for-byte against the source tree before zipping.

## Not done yet / carried forward

- **Phase C (schema anchor migration)** is next — explicitly paused for your sign-off before it runs, since it's the phase touching the most tables at once (leads, engagements, tasks, classes, service_requests, documents, budget_requests, expenses, blockers) and needs a decision on how GDC's existing PMP-shaped data maps onto the new catalog.
- Phases D–G (Opportunity/Pipeline generalization, Customer Workspace rebuild, document engine + public entry point generalization, validation scenarios) are unstarted, per the build sequence doc.
- DPO payment verification (Track 1) is independent of this and is yours to run whenever convenient — instructions are in the build sequence doc, not repeated here since no code changed for it in this package.
