# VBP Navigator OS — Phase C: Product/Service Schema Anchor

Track 2, Phase C of the "NavigatorOS Operating Model Refinement" correction — the schema-anchor step explicitly paused for Diallo's sign-off, run after that sign-off ("go", 2026-09-18). Full sequencing context is in the project docs (`vbp-navigator-os-portfolio-correction-assessment.md` and `vbp-navigator-os-v3-build-sequence.md`).

## What changed

Every customer-facing entity that can be "about" one of GDC's real, sellable offerings — a public application (Prospect), a pipeline Lead, the Engagement a Lead becomes on admission, and a scheduled Class — gets a new, optional `product_service_id`: a reference into the Products & Services Catalog built in Phase 16 (`price_catalog_items`).

This is deliberately additive, not a rewrite. Nothing about the existing `service_id` column changes anywhere — it keeps meaning exactly what it always has ("which internal capability/team owns this record for permission purposes"). `product_service_id` answers a different, previously-conflated question: "what is this customer actually buying." The two coexist. No table was renamed, no foreign key was rewired, no permission check changed.

**What this deliberately does NOT do**: it does not touch Budget Requests, Expenses, Compensation, Tasks, Blockers, or Service Requests — those stay anchored to the internal Service & Value Architecture only, per the assessment doc's own guidance (compensation especially is about internal role pay, not a sold product). It also does not rename any LeadStage value (`assessed`/`admitted` stay as-is) or touch `admitLead()`'s name — that PMP-vocabulary cleanup is Phase D, sequenced next.

**No fake data was seeded or backfilled.** Every existing row's `product_service_id` stays `null` — there is nothing real to backfill it with, since the catalog still ships empty until Diallo enters GDC's real portfolio. A lead, class, or prospect with no product set behaves exactly as it did before this phase.

## Where it shows up

- **Pipeline** (`/pipeline`) — the "Add lead" form gets an optional "Product/offering" picker (only shown once the catalog has active items), and any lead with a product set shows it as a badge on its card.
- **Classes** (`/classes`) — same picker on "Schedule class," same badge on each class card.
- **Prospects** (`/prospects`) — the staff "Log inquiry" form gets the same optional picker; a prospect's product shows as a badge, and promoting a prospect to a lead now carries its product forward automatically.
- **Customers** (`/customers`) — an Engagement now shows its product name (when the admitted lead had one) instead of the internal service name — this is the first place in the app where a customer's own journey reads in terms of what they bought, not which internal process handled them.
- **The public `/apply` and `/assess` forms** — this is the actual correction the whole track exists for. These forms previously only offered the internal Service & Value Architecture's CVS list (Readiness Assessment, Candidate Admission, ...) — an internal process list, not GDC's real portfolio. They now fetch the real Products & Services Catalog (new public endpoint, `/api/public/org/:slug/products`) and show that instead, whenever the org's catalog has at least one active item. **Falls back to the original service-based picker whenever the catalog is empty**, so the public forms never go blank waiting on the catalog to be filled in — verified both ways in this package's testing.

## Apply

1. Run the migration: `supabase/migrations/0023_phasec_product_service_anchor.sql` — four `alter table ... add column if not exists` statements (leads, prospects, engagements, classes) plus four indexes. Purely additive, no data loss, no backfill.
2. Copy the other 26 files into the matching paths, overwriting what's there. No new components, no new dependencies — every change is to an existing file.
3. `npm run build` to confirm, then deploy.
4. Nothing further is required to go live — the product pickers simply won't show (falling back to today's behavior) until there's at least one active item in **Products & Services** (`/settings/price-catalog`).

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **20 new assertions**, run against a freshly reset local database: a catalog product created, then threaded through a Lead (with and without one set), a PATCH that sets/updates a lead's product independently of its stage, a Class, a staff-logged Prospect, promoting that prospect into a Lead (confirmed the product carries forward), admitting a Lead all the way to an Engagement (confirmed the product carries forward again), and the new public products endpoint (confirmed it returns only active items and never leaks price or internal pricing-model fields, and that deactivating an item removes it from the public list). Re-run twice on independently fresh databases — 20/20 both times.
- **Zero regressions**: Phase 15 (29 assertions) and Phase 16 (22 assertions) suites re-run clean against this build, each on its own freshly reset database, after tracking down and fixing a stale-server artifact from this sandbox's own process management (a leftover server process from earlier testing was still bound to the target port and serving old data — not a code issue; documented so it isn't mistaken for one).
- Full page-route regression sweep: every existing page (`/`, `/tasks`, `/pipeline`, `/classes`, `/budget`, `/compensation`, `/capabilities`, `/service-requests`, `/prospects`, `/customers`, `/documents`, `/commercial`, `/advisor`, `/dashboard`, `/memory`, `/settings/company`, `/settings/price-catalog`, `/apply/vbp`, `/assess/vbp`) still returns 200.
- Playwright screenshots at 1440px and 390px of Pipeline (product picker + badges on leads, one with a product and one without), Classes (same), Prospects (staff-log form's product picker, a promoted prospect's product badge), Customers (an engagement showing its product name), and the public `/apply` form correctly showing the real catalog product ("MS Project Training") with its description hint instead of the old internal-service list. No horizontal overflow at mobile width.
- Every file in this package diffed byte-for-byte against the source tree before packaging.

## Not done yet / carried forward

- **Phase D (Opportunity/Pipeline generalization)** is next: the `LeadStage` enum's PMP-specific values (`assessed`/`admitted`), the `admitLead()` function name, and the pipeline board's stage labels still read as PMP's own process rather than a generic pipeline. Not touched in this phase on purpose — kept as its own reviewable step, per the build sequence doc.
- Phases E–G (Customer Workspace rebuild, document-engine + public-entry-point generalization, the brief's own four validation scenarios) are unstarted.
- Track 1 (DPO payment verification) remains independent and is Diallo's to run whenever convenient.
- No UI yet to bulk-assign a `product_service_id` to existing leads/classes/engagements created before this phase (or before the catalog had real entries) — each can be set individually via its own picker/PATCH, but there's no "assign this product to these 12 existing rows" batch tool. Worth building if GDC wants its historical data reclassified rather than just going forward from here.
