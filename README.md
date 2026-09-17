# VBP Navigator OS — Phase 13: Organizational Memory (roadmap's own Phase 9, §17)

The roadmap's own **Phase 9**, built as this project's sequential Phase 13 (following Phases 11/12, the enhancement backlog's Clusters D/E). Chosen directly by Diallo after Phase 12 closed the backlog in full — a bare "proceed" needed disambiguating, offered via `AskUserQuestion` as Phase 9, Phase 10, or "something else"; Diallo picked Phase 9. Full detail (design calls, what was verified, what's carried forward) is in the "v3.0 roadmap — Phase 13: Organizational Memory" entry of `claude/vbp-navigator-os-v2-build-guide.md`, synced to the project. This README is the short version for applying the files.

## What this ships

The roadmap's own one-line scope: "Decision/lesson capture (§17), feeding directly into what the AI layer built in Phase 8 can surface as historical pattern-matching." Two halves:

- **A decision/lesson log anyone in the org can add to** — new `/memory` page, tied to a service when it's about one, org-wide when it isn't.
- **Trend vs. a prior day's KPI snapshot** — closes the exact gap Phase 8's and Phase 12's own carried-forward lists both named and deferred pending this phase. Captured opportunistically (no cron — this app has never had one) the first time the Dashboard or Advisor loads on a given day.

The AI Advisor's snapshot (`lib/ai-context.ts`) now includes both: `trend` (every live KPI number minus the prior snapshot's — `null` until an org has a second day's data) and `recentMemory` (the newest 8 logged entries, as history the model can pattern-match against).

## Apply

1. **Run the migration first**: `supabase/migrations/0019_phase13_organizational_memory.sql` — two new tables, `org_memory` and `org_kpi_snapshots`, both RLS-enabled (mirrors the `comments` table's org-scoped, anyone-can-post pattern).
2. Copy the other 14 files in this package into the matching paths in the repo, overwriting what's there.
3. `npm install` isn't needed — no new dependencies.
4. `npm run build` to confirm, then deploy as usual.

## Files in this package (15)

```
supabase/migrations/0019_phase13_organizational_memory.sql
lib/db-org-memory.ts
lib/ai-context.ts
app/api/memory/route.ts
app/api/dashboard/route.ts
app/api/ai/observe/route.ts
components/advisor/AdvisorView.tsx
app/memory/page.tsx
components/memory/types.ts
components/memory/NewMemoryEntryForm.tsx
components/memory/MemoryEntryItem.tsx
components/memory/MemoryWorkspace.tsx
components/ui/icons.tsx
components/ui/Sidebar.tsx
components/ui/navConfig.ts
```

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean, twice (once before and once after a throwaway diagnostic route used for verification was deleted).
- Trend math checked against hand-seeded data via a temporary diagnostic route (built, used, deleted before packaging — same pattern as this project's earlier `/api/debug` and Phase 12's `/api/debug-ai-context` endpoints): confirmed `trend` is `null` with no prior-day snapshot, and confirmed every delta computes correctly (e.g. `activeWork: -3` for a live 0 against a hand-inserted prior value of 3) once one exists. `recentMemory` checked for correct newest-first ordering and service-name resolution (real name for a service-scoped entry, `null` for org-wide).
- 23-assertion Node.js smoke test against a freshly reset local SQLite database: `/api/memory` GET/POST (validation, creation, listing, type fallback, service-scoped entries), `/api/dashboard` triggering snapshot capture without erroring (including an idempotent same-day repeat), `/api/ai/observe`'s existing 503-with-no-key path confirmed unbroken by the new capture/trend/recentMemory wiring, `/memory` page rendering, plus a full regression sweep of every other page route — 23/23 passing.
- Playwright screenshots at 1440px and 390px of `/memory` (default and after a real form submission) and `/advisor` (updated description copy) — no horizontal overflow at either width, correct active-nav highlighting, dark-mode tokens inherited automatically from existing primitives.
- Every file in this package diffed byte-for-byte against the source tree before zipping.

## Not done yet / carried forward

- No update/delete path for a logged entry — same gap `comments` (Phase 6) has always carried, not new here.
- A KPI snapshot reflects a day's *first* page load, not its last — documented, deliberate.
- `trend`'s content was verified via a direct snapshot-builder call with a hand-inserted prior snapshot, not a live Anthropic response reasoning over a real multi-day trend — worth a real "Generate insights" click a day or two after this ships.
- `/memory` has no pagination or filtering by type/service yet — fine at a 5-person org's volume for a while.
- **This closes the roadmap's own Phase 9 (Organizational Memory).** What's left standing behind it is the roadmap's Phase 10 (Scenario/What-if) — explicitly last, per the brief's own instruction not to build it prematurely (§21) — plus the cross-cutting items the build guide already tracks (API connector design, ongoing mobile/responsive passes, code-cleanliness discipline).
