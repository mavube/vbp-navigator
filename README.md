# VBP Navigator OS — Phase D: Opportunity/Pipeline Generalization

Track 2, Phase D of the "NavigatorOS Operating Model Refinement" correction — run after Diallo's "PROCEED" (2026-09-18), immediately following Phase C's product/service schema anchor. Full sequencing context is in the project docs (`vbp-navigator-os-portfolio-correction-assessment.md` and `vbp-navigator-os-v3-build-sequence.md`).

## What changed

The Pipeline (Leads) feature is generic — any org can run any kind of sales process through it — but its own vocabulary didn't read that way. A lead's `stage` could only ever be `assessed` or `admitted`, the function that converts a won lead into a real Customer + Engagement was named `admitLead()`, and the Pipeline page's own description told the org this feature exists for exactly two named internal services ("Readiness Assessment and Admission"). None of that was true generically — it was PMP's own process language baked into what's supposed to be a reusable CRM pipeline, the same class of problem Phase C fixed for the schema layer.

This phase replaces that vocabulary with standard, generic pipeline language, end to end:

- **`LeadStage`**: `"new" | "contacted" | "assessed" | "admitted" | "lost"` → `"new" | "contacted" | "qualified" | "won" | "lost"`. `new`, `contacted`, and `lost` were already generic and are untouched.
- **`admitLead()` → `convertLead()`** (`lib/db-engagements.ts`) — same behavior (find-or-create the Customer, open a new Engagement, carry the lead's `product_service_id` forward per Phase C), new name.
- **The Pipeline page's own description** no longer names two specific internal services as if that's all Pipeline is for — it now describes what the feature generically does, for any service or product in the portfolio.
- Every place that read or wrote the old stage values — the API's validation list, the pipeline board's filters (Active vs. Closed), the AI advisor's pipeline-aging context, the reporting rollups (`leadsAdmitted` → `leadsWon`), the Capabilities → Outcomes stat label ("Leads admitted" → "Leads won") — was updated to match.
- **A migration** (`0024_phased_pipeline_vocabulary.sql`) updates any real rows already sitting under the old stage names (Diallo has already deployed Phase 16 and, per the sequencing, Phase C — real leads may already exist under `assessed`/`admitted`) and replaces the database's own check constraint, so this isn't just an app-layer rename.

**What this deliberately does NOT do**: it does not touch the document engine's `PRE_ADMISSION_TYPES`/`POST_ADMISSION_TYPES` split or the `admission_communication` document type (`lib/document-templates.ts`, `components/documents/NewDocumentForm.tsx`) — that generalization is Phase F's job, kept as its own reviewable step rather than folded in here. It also leaves the real Service & Value Architecture's own description of GDC's actual PMP CVS chain (Readiness Assessment, Candidate Admission, PMP Master Class Delivery, etc. — in `components/architecture/ArchitectureView.tsx`, `components/GdcTable.tsx`, `components/GdcChain.tsx`) and the PMP-specific `/assess` readiness-assessment flow untouched — those are accurate descriptions of a real capability GDC has, not the "NavigatorOS assumes this is the *only* thing GDC does" bug this track exists to fix.

## Where it shows up

- **Pipeline** (`/pipeline`) — stage badges now read New / Contacted / Qualified / Won / Lost; the "mark next stage" button reads "Mark qualified" / "Mark won" instead of "Mark assessed" / "Mark admitted"; the page's own description no longer names two specific internal services.
- **Customers** (`/customers`) — the page description and the empty-state copy now say "the moment a lead is won" instead of "is admitted."
- **Capabilities → Outcomes** (`/capabilities`) — the per-service stat reads "Leads won" instead of "Leads admitted."
- **The API** (`PATCH /api/leads/:id`) — only understands the new stage names now. A client (or a stale bookmark/script) that sends `"stage": "assessed"` or `"admitted"` gets a 400, not a silent misinterpretation — verified in this package's testing.

## Apply

1. Run the migration: `supabase/migrations/0024_phased_pipeline_vocabulary.sql`. It drops the old `leads_stage_check` constraint, updates any existing rows (`assessed` → `qualified`, `admitted` → `won`), then adds the new constraint. Order matters and is handled in the file — apply it as-is.
2. Copy the other 16 files into the matching paths, overwriting what's there. No new components, no new dependencies — every change is to an existing file.
3. `npm run build` to confirm, then deploy.
4. **Deploy the migration and the app together, or migration-first.** The app's API only accepts the new stage names the moment it's running this code — if the app deploys before the migration runs against a database that already has newer-vocabulary rows written some other way, nothing breaks (both migration and app agree on the same final vocabulary either way), but don't leave the old app code running against a database that's already been migrated, since old code would reject rows it can no longer recognize. In practice: run the migration, then deploy.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **13 new assertions**, run against a freshly reset local database: a new lead defaults to stage `new`; the old stage names `assessed` and `admitted` are now rejected outright (400) rather than silently accepted; the full new-vocabulary path (`contacted` → `qualified` → `won`) works and `won` still creates a Customer + Engagement through the renamed `convertLead`; the lead list and `/api/customers` reflect the new stage; `lost` (an untouched value) still works; and the rollups endpoint reports `leadsWon` (and no longer has a `leadsAdmitted` field at all).
- **Zero regressions**: Phase 15 (29 assertions) and Phase 16 (22 assertions) suites re-run clean, each on its own freshly reset database. Phase C's own 20-assertion suite was updated to use the new stage names (`qualified`/`won` in place of `assessed`/`admitted` — the old names it exercised no longer exist, which is the point of this phase, not a regression) and re-run clean, 20/20.
- Full page-route regression sweep: all 19 existing routes (`/`, `/tasks`, `/pipeline`, `/classes`, `/budget`, `/compensation`, `/capabilities`, `/service-requests`, `/prospects`, `/customers`, `/documents`, `/commercial`, `/advisor`, `/dashboard`, `/memory`, `/settings/company`, `/settings/price-catalog`, `/apply/vbp`, `/assess/vbp`) still return 200.
- Playwright screenshots at 1440px and 390px of Pipeline (new stage badges and "Mark won"/"Mark lost" buttons, the corrected page description, a lead in each of Qualified/Won/Lost), Customers (corrected copy, the won lead's customer record), and Capabilities → Outcomes ("Leads won" stat). No horizontal overflow at mobile width.
- Every file in this package diffed byte-for-byte against the source tree before packaging.

## Not done yet / carried forward

- **Phase E (Customer Workspace rebuild)** is next per the build sequence doc.
- Phase F (document engine + public entry point generalization — the `PRE_ADMISSION_TYPES`/`POST_ADMISSION_TYPES` split and `admission_communication` document type, explicitly left alone in this phase) and Phase G (the brief's own four validation scenarios) remain unstarted, gated behind Phase E.
- Track 1 (DPO payment verification) remains independent and is Diallo's to run whenever convenient.
- The real Service & Value Architecture's own PMP-specific content (the actual CVS chain, the `/assess` readiness-assessment flow) is untouched by design — it's accurate, not a bug. Nothing further to do there.
