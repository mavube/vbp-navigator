# Phase 3 — Financial Year dimension — apply instructions

v3.0 roadmap, Phase 3. Adds fiscal-year filtering to Budget/Compensation/Expenses
numbers and a previous/current/next FY comparison view. FY = calendar year (Jan–Dec),
per the confirmed decision — no schema migration in this phase; FY is computed from
dates your database already stores.

## No database migration needed

Unlike Phases 1 and 2, there's nothing to run in Supabase for this one. `fiscal_year`
is computed on the fly from `created_at` / `expense_date` / `period`, not stored as a
new column — see `lib/fiscal-year.ts`'s header comment for why.

## Replace/add these files (same relative paths)

- `lib/fiscal-year.ts` — **new file**
- `lib/rollups.ts` — replaces the whole file
- `app/api/rollups/route.ts` — replaces the whole file
- `components/capabilities/CapabilitiesWorkspace.tsx` — replaces the whole file
- `components/capabilities/OutcomesView.tsx` — replaces the whole file
- `components/capabilities/types.ts` — replaces the whole file (adds one new interface)
- `claude/vbp-navigator-os-v2-build-guide.md` — replaces the whole file (documentation only; already synced to the Claude project too)

## What changed for users

On the Capabilities page's Outcomes tab, there's now a "Financial year comparison"
card at the top showing FY2025/FY2026/FY2027 totals for Budget approved, Expenses,
and Net pay — and clicking a year there scopes every service's own Budget/Expenses/
Net-pay stats below to that year (or back to "All time", the previous default).
Nothing else in the app changed — Workload tab, Budget/Compensation module pages, and
every other screen are untouched.
