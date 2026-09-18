# VBP Navigator OS — Lead Assessment Data Fix

A follow-up to the "NavigatorOS Operating Model Refinement" track (Phases B–G), addressing the first of Diallo's post-Phase-G clarifications: "if I view a Lead who came in via the assessment... I'd wish to see the lead's assessment score, what drives them, what challenges they're facing... real talking points for a sales follow-up call. This is a decision-supporting system, not QuickBooks or Tally."

## What was wrong

The `/assess` public intake form already captures exactly this kind of context — years of experience, certification status, preferred timing, and a free-text "what's prompting you to pursue this now?" answer (`components/public/ApplyForm.tsx`'s `ASSESSMENT_QUESTIONS`). It's stored correctly on the `Prospect` record (`prospects.assessment_answers`, built back in Phase 4). But `lib/db-prospects.ts`'s `promoteProspectToLead` — the function that turns a reviewed prospect into a real pipeline Lead — never carried that field across. The data was captured, then silently dropped the moment a prospect became a Lead. By the time a salesperson opened the Lead to make a follow-up call, the assessment answers were already gone.

This wasn't a portfolio-correction bug (it predates that track) — it's a separate, genuine data-loss bug, and the first concrete step toward Diallo's broader "smart pages, not just QuickBooks" direction, confirmed as the starting point via his own decision ("fix the Lead assessment-data loss first").

## What changed

- **`supabase/migrations/0026_leadassessment_answers.sql`** — adds a nullable-safe `assessment_answers jsonb not null default '{}'` column to `leads`, the same shape and default as `prospects.assessment_answers` already has. Additive only, same pattern as Phase C's `product_service_id` migration: existing leads get the default, nothing is backfilled, no code path requires it.
- **`lib/db-leads.ts`** — `LeadRow`/`NewLead` types, the SQLite defensive `ALTER TABLE ... ADD COLUMN` guard, `fromSqliteRow`, `PG_COLS`, and `createLead` all now carry `assessmentAnswers` through, exactly mirroring how `lib/db-prospects.ts` already handles the same field.
- **`lib/db-prospects.ts`** — `promoteProspectToLead` now actually passes `prospect.assessmentAnswers` into the `createLead` call. This one line is the actual fix; everything else in this package exists to support it.
- **`lib/assessment-questions.ts`** (new) — the `ASSESSMENT_QUESTIONS` list (key, human label, type, options) that used to live only inside `ApplyForm.tsx`, pulled out into its own module so the Lead panel and the `/assess` form that asks these questions read from one shared definition instead of the label text risking drifting between the two places it appears.
- **`components/public/ApplyForm.tsx`** — now imports `ASSESSMENT_QUESTIONS` from `lib/assessment-questions.ts` instead of defining it locally. No behavior change — `/apply` and `/assess` render identically to before.
- **`components/pipeline/types.ts`** — the client-side `Lead` type gains `assessmentAnswers: Record<string, unknown>`.
- **`components/pipeline/LeadItem.tsx`** — new "Assessment — for the follow-up call" panel, shown only when a lead actually has assessment answers (i.e., it was promoted from an `/assess` prospect). Rendered from `ASSESSMENT_QUESTIONS` in the order the questions were actually asked, with their real labels ("Years of project-related work experience: 3–5 years"), not raw JSON keys — the same raw-key-value pattern still used on `ProspectItem.tsx` (left as-is; out of scope for this fix, since a Prospect's own review screen isn't the sales-follow-up moment Diallo described). A lead with no assessment answers (staff-logged, or promoted from a plain `/apply` prospect) shows no panel at all — nothing invented, nothing padded.

## Why a migration is required

`leads` has no existing `assessment_answers` column, and the app reads/writes it through this exact name in both drivers. On Postgres, the column has to exist before the app's queries reference it — `alter table ... add column if not exists` is safe to run against a live table with existing rows (get the new column's default, nothing else changes). SQLite (local dev) has no separate migration step; `lib/db-leads.ts`'s own defensive `ALTER TABLE` guard adds the column on first run against an existing `dev.db`, same pattern used for every prior schema addition in this codebase.

## Apply

1. Run `supabase/migrations/0026_leadassessment_answers.sql` against production, in order after `0025`.
2. Copy the 6 application files into the matching paths, overwriting what's there.
3. `npm run build` to confirm, then deploy.
4. Nothing further required. The fix applies going forward — leads already created (under the old, data-dropping code) have no assessment answers to show and will keep showing none, since there's nothing real to backfill them with (no fabricated data, per this project's discipline). Any *new* prospect promoted after this deploys will carry its answers through correctly.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **13 new assertions**, run against a freshly reset local database, covering three scenarios: (1) an `/assess`-sourced prospect with real assessment answers is created, reviewed, and promoted — the resulting Lead's `assessmentAnswers` (via both the promote response and a subsequent `GET /api/leads`) match exactly what was submitted, byte for byte; (2) a plain `/apply`-sourced prospect (no assessment) is promoted — the resulting Lead correctly has an empty `{}`, not `null` or an error; (3) a lead logged directly by staff through `POST /api/leads` (which never sends this field at all) also correctly defaults to `{}`. 13/13 passed.
- **Zero regressions**: the full Phase G suite (41 assertions — all four portfolio-correction scenarios: PMP, MS Project Training, ValueBlueprint Advisory, existing-customer expansion) re-run clean against a freshly reset database with this change applied. The 13 new assertions above were then re-run again on top of that same live Phase-G state (multiple real leads, customers, and engagements already in play) to confirm the two don't interact badly — still 13/13.
- Playwright screenshots at 1280px and 390px (mobile): the Pipeline board showing three leads side by side — a staff-logged lead (no panel), a plain-application lead (no panel), and an assessment-sourced lead showing the full labeled panel ("Years of project-related work experience: 3–5 years," "Do you currently hold a related certification or qualification?: Yes — in progress," "Preferred start timing: As soon as possible," "What's prompting you to pursue this now?: Manager wants the team PMP-certified before the Q1 rollout.") — confirming both the positive case renders correctly and the negative cases show nothing extra. No horizontal overflow or layout breakage at mobile width.
- Every file in this package diffed byte-for-byte against the live source tree before packaging.

## Not done yet / carried forward

- This is the first of three confirmed next steps from Diallo's post-Phase-G feedback. Still open: (2) converting the Products & Services Catalog's Category and Type fields from free-text to enforced dropdowns, and (3) building the same "structured facts, not raw JSON" treatment for Customer, Product, and Invoice/Quote/Proposal pages — Diallo's broader "decision-supporting system, not QuickBooks" direction, confirmed as "structured facts first" (no AI synthesis yet).
- The production "empty white space" sidebar-gap report remains unresolved — no code-level cause was found in investigation, and it needs either a production screenshot/URL or confirmation of exactly what's deployed live before it can be diagnosed further.
- `components/prospects/ProspectItem.tsx` still renders assessment answers as raw `Object.entries(...)` key/value pairs — intentionally left alone here, since a Prospect's review screen (internal triage, before this person is even a real Lead) isn't the sales-follow-up moment this fix targets. Worth the same treatment in a future pass if Diallo wants consistency across both screens.
- Everything already carried forward from Phase G's own report (production re-validation, no bulk `product_service_id` backfill tool, Track 1/DPO independent, "next opportunity" suggestions still a simple filter) is unchanged by this fix.
