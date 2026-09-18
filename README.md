# VBP Navigator OS — Phase F: Document Engine Vocabulary Correction

Track 2, Phase F of the "NavigatorOS Operating Model Refinement" correction — run after Diallo's "proceed.." on the Phase E delivery. This is the last of the data/vocabulary phases; Phase G (the brief's own four validation scenarios) is next.

## What changed

The document-generation engine's `admission_communication` document type, and the `PRE_ADMISSION_TYPES`/`POST_ADMISSION_TYPES` constants that route every document to a lead-anchor or an engagement-anchor, were named after PMP's own Candidate Admission CVS — a specific GDC service, not a concept every offering shares. MS Project Training and ValueBlueprint Advisory don't have a formal "admission" step the way PMP's certification program does, so a document engine that talks about "admission" for every service is the exact bug this whole correction track exists to fix, just in the document layer instead of the pipeline layer (Phase D) or the schema anchor (Phase C).

This phase is a rename, not a behavior change — the underlying rule ("some document types need a Lead because no Customer exists yet; others need a real Engagement") is untouched, and so is every other document type.

- **`admission_communication` → `welcome_communication`** (label: "Admission Communication" → "Welcome Communication"), across the `DocumentType` union, `DOCUMENT_TYPE_LABELS`, the `TEMPLATES` record, and `components/documents/types.ts`'s own copy of the type union.
- **The template body itself** dropped "Congratulations — you've been admitted to…" in favor of "Congratulations — you're all set for…" — the old copy assumed a formal admission decision; the new copy works whether the service is a certification with an admission step, a training course with no such step, or an advisory engagement that was simply agreed to.
- **`PRE_ADMISSION_TYPES` → `PRE_ENGAGEMENT_TYPES`, `POST_ADMISSION_TYPES` → `POST_ENGAGEMENT_TYPES`** in `lib/document-templates.ts` — same two sets, same members (just `welcome_communication` instead of `admission_communication` in the post set), new names that describe what the rule actually is: whether a real Engagement exists yet, not any one service's admission process. Updated everywhere these were imported: `lib/document-context.ts`'s `resolveDocumentAnchor`, `app/api/documents/route.ts`'s validation, and `components/documents/NewDocumentForm.tsx`'s `isPreAdmission` → `isPreEngagement`.
- **A real copy bug, found while in this file**: `NewDocumentForm.tsx` still said "a lead needs to be marked **admitted** on Pipeline first" when there is no "admitted" stage any more — Phase D renamed it to "won" back in that phase's own delivery, but this specific hint text was explicitly left for Phase F (flagged in both Phase C's and Phase D's own "not done yet" sections). Fixed to "marked **won**."
- **`app/documents/page.tsx`'s description** — user-facing prose that literally said "…admission communications…" — updated to "…welcome communications…".

**Confirmed already done, no changes needed:** the other half of this phase's brief — "`/apply` and `/assess` should ask which GDC offering someone's interested in, not assume PMP" — was already built in Phase C. Both public forms use the same `ApplyForm` component, and its "What are you interested in?" picker already pulls from the live, active Products & Services Catalog. Verified with a fresh screenshot (`apply_demo.png`, included in this package's screenshot set below, not shipped as an app file) rather than taken on faith.

## Why a migration is required

`documents.doc_type` has a Postgres CHECK constraint (`documents_doc_type_check`, added in migration `0020_phase14_commercial_documents.sql`). Renaming an enum-like value at the app layer without updating the constraint would mean the constraint still only allows the old name — every future `welcome_communication` insert would be rejected by the database, even though the app code above it says the value is valid. `0025_phasef_document_vocabulary.sql` drops the constraint, updates any existing `admission_communication` rows in place to `welcome_communication` (Diallo has deployed through Phase 16 and probably C/D/E by now — real rows may already exist under the old name), then re-adds the constraint with the new value list. Exactly the same shape as Phase D's `0024_phased_pipeline_vocabulary.sql` for the lead-stage rename. SQLite (local dev) has no CHECK constraint on this column, so nothing else needed changing there.

## Apply

1. **Run the migration first**: `supabase/migrations/0025_phasef_document_vocabulary.sql`, in order after `0024`.
2. Copy the 7 application files into the matching paths, overwriting what's there.
3. `npm run build` to confirm, then deploy.
4. Nothing further required to go live. Any documents already generated under the old `admission_communication` type will show up correctly labeled "Welcome Communication" the moment the migration and the deploy have both landed.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **17 new assertions**, run against a freshly reset local database: baseline services load; `GET /api/documents` loads; generating a `welcome_communication` document against a real engagement succeeds and its type/label/body are correct (including a direct assertion that the body contains "all set" and not "admitted"); the **old** `admission_communication` type is now rejected outright (400) — mirrors Phase D's "old stage name rejected" pattern; every other plain-letter type (`invitation`, `approval_request`, `confirmation`, `completion_record`) still generates correctly against the right anchor (lead vs. engagement); `welcome_communication` still requires an `engagementId`, not a `leadId` (400 if given the wrong one); the generated document shows up in the `GET /api/documents` list; a Phase 14 commercial document (invoice) generates correctly, confirming this phase left that flow untouched; and the `/documents`, `/apply/:org`, `/assess/:org` page routes all return 200.
- **Zero regressions**: Phase D (13), Phase C (20), Phase 16 (22), Phase 15 (29), and Phase E (17) suites all re-run clean, each on its own independently freshly reset database.
- Full page-route sweep: 18 routes, all 200.
- Playwright screenshots at 1440px and 390px: the Documents workspace with "Welcome Communication" selected in the type picker and showing correctly on a generated document's badge and title ("Welcome — Master Class Delivery (demo)"), the updated description prose, and the `/apply` public form's offering picker (confirming Phase C's work is already live there). No horizontal overflow at mobile width.
- Every file in this package diffed byte-for-byte against the source tree before packaging.

## Not done yet / carried forward

- **Phase G** (the brief's own four validation scenarios: PMP, MS Project Training, ValueBlueprint Advisory, existing-customer expansion, run end-to-end as smoke tests) is next — this was the last phase gating it, so Phase G is now unblocked on the app side. It's still gated on a second real catalog offering actually existing in the live org, which is Diallo's to set up.
- A handful of **comment-only** references to "admission"/"pre-admission"/"post-admission" remain in `lib/db-leads.ts`, `lib/db-customers.ts`, and `app/api/leads/[id]/route.ts` — none of them user-facing or functional, describing the generic "a prospect converts into a customer" concept rather than PMP's process specifically. Left as-is; lower priority than the functional and user-facing fixes in this phase, and callable out in a future cleanup pass if GDC wants it.
- `components/public/ApplyForm.tsx`, `app/api/leads/route.ts`, and `app/api/public/org/[slug]/products/route.ts` reference "Candidate Admission" in comments — this is PMP's actual real CVS name (a legitimate specific service that exists in the catalog), not a generalization bug, so intentionally untouched.
- Track 1 (DPO payment verification) remains independent and is Diallo's to run whenever convenient.
- Everything else carried forward from Phase E's README (no bulk `product_service_id` backfill tool, Customer Workspace's "next opportunity" suggestions being a simple filter rather than a recommendation engine) is unchanged by this phase.
