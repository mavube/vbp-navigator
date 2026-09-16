# Phase 2 — Service Catalogue + Graph — apply instructions

v3.0 roadmap, Phase 2. Replaces the old static v1.0 "Service Architecture" tab on the
root `/` page with a live view computed from the real `services` table.

## 1. Run the new migration against your real Supabase project

`supabase/migrations/0011_phase2_v3_catalogue.sql` — adds five nullable-safe text
columns to `services`: `description`, `customer_need`, `target_customer`,
`delivery_model`, `commercial_model`. Pure additive, safe against existing rows.

Run it in the Supabase SQL editor (or via your usual migration path) **before**
deploying the code below, or after — order doesn't matter functionally, but the new
catalogue fields will show blank in the UI until both the column and the code are in
place. **This is the one step that must not be skipped** — without it, the Service
Catalogue's new fields simply won't have anywhere to read from in production
(local SQLite dev doesn't need this step — it creates its own columns automatically).

## 2. Replace these files in your repo (same relative paths)

- `lib/db-services.ts` — replaces the whole file
- `lib/findings-data.ts` — replaces the whole file (content-only change: Findings 2/3 text)
- `components/architecture/ServiceGraph.tsx` — **new file**
- `components/architecture/ServiceCatalogue.tsx` — **new file**
- `components/architecture/ArchitectureView.tsx` — **new file**
- `app/page.tsx` — replaces the whole file
- `styles/components.css` — replaces the whole file (adds background/font/color to `.v2-page-shell`; everything else unchanged from Phase 1)
- `claude/vbp-navigator-os-v2-build-guide.md` — replaces the whole file (documentation only; already synced to the Claude project too)

## 3. Delete these files — confirmed dead, no remaining references (grepped first)

- `components/NavigatorApp.tsx`
- `components/ServiceCards.tsx`
- `components/InternalChain.tsx`

## 4. After deploying

- Clear `.next` and rebuild if you see a stale route error (`npm run build`, clearing
  the cache first) — this bit us twice in this sandbox after deleting route/component
  files, unrelated to your setup but worth knowing.
- The root `/` page's "Internal Operation" tab will now show a live dependency graph
  and full catalogue cards for whatever is actually in your `services` table. The
  "Reference Case — GDC PMP" tab is untouched — still the fixed static reference
  content.
