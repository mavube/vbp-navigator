# Phase 6 — Work Views + Blocker Intelligence

v3.0 roadmap Phase 6 (§10/§11): Kanban, Gantt, and Calendar views alongside
Tasks' existing List, plus first-class Blocker objects (owner, impact,
required action). Also fixes a mobile layout bug in the Phase 6a sidebar
shell that this phase's own verification uncovered — see "Mobile shell fix"
below. Full detail is in the build guide's Phase 6 entry.

## How to apply

1. **Run the migration first**, before deploying the code: `supabase/migrations/0014_phase6_work_views_blockers.sql` against your Supabase project (adds `tasks.start_date`, creates the `blockers` table + RLS policies).
2. **New files** — copy these in as-is, no existing counterparts:
   - `lib/db-blockers.ts`
   - `app/api/blockers/route.ts`
   - `app/api/blockers/[id]/route.ts`
   - `components/tasks/TaskKanban.tsx`
   - `components/tasks/TaskGantt.tsx`
   - `components/tasks/TaskCalendar.tsx`
   - `components/tasks/BlockersPanel.tsx`
3. **Replace these existing files** at the same paths:
   - `lib/db-tasks.ts` (adds `startDate` + `updateTaskDates()`)
   - `app/api/tasks/route.ts` (POST now reads `startDate`)
   - `app/api/tasks/[id]/route.ts` (PATCH rewritten — accepts `status` and/or dates together)
   - `components/tasks/types.ts` (adds `startDate`, `Blocker` types)
   - `components/tasks/NewTaskForm.tsx` (adds Start/Due date fields)
   - `components/tasks/TaskItem.tsx` (adds blocked badge, inline date editor)
   - `components/tasks/TaskBoard.tsx` (view-switcher + Blockers panel, full rewrite)
   - `app/tasks/page.tsx` (description text update only)
   - `styles/components.css` — **replace the whole file.** In addition to this phase's new `.v2-kanban-grid` / `.v2-section-actions` rules, it contains the mobile shell fix below, which touches the existing `@media (max-width: 960px)` block from Phase 6a.
4. Rebuild (`npm run build`) and redeploy as usual (Vercel auto-redeploys on push).

No new npm dependencies — Gantt and Calendar are both hand-built components, same "no new dependency where a plain component works" call as Phase 5's document rendering.

## Mobile shell fix (found during this phase, not new scope)

While verifying the four Task views on mobile, a pre-existing bug from Phase
6a's sidebar shell surfaced: `.v2-mobilebar` (the hamburger+brand bar) is a
normal-flow sibling of the main content column inside `.v2-shell`'s flex
row. `.v2-sidebar` itself correctly switches to `position: fixed` on mobile
(out of flow, as intended), but the mobilebar stayed `position: sticky`
(still in-flow) with no explicit width — so it sized itself to its own
content (~160px) as a flex item sitting *beside* the page content, instead
of a full-width bar *above* it. That silently squeezed every page's usable
mobile width down to under 200px on a 390px phone screen.

This was invisible in Phase 6a's own screenshots because Documents/
Architecture's content still happened to read okay cramped into ~190px —
it only became obvious once Kanban's grid and Gantt's chart needed their
true available width. Fixed in `styles/components.css` with:

```css
.v2-shell { flex-wrap: wrap; }
.v2-mobilebar { flex: 1 1 100%; }
.v2-shell-main { flex: 1 1 100%; }
```

so the mobile bar takes its own full-width row and the content column gets
the rest. Verified via `getBoundingClientRect()` diagnostics (main content
column now ~350px of a 390px viewport, matching the pre-existing 20px
global body padding on each side — not the ~188px it was measuring before)
and re-screenshotted every page, not just this phase's new views. This
affects **every page**, not just Tasks, since the shell wraps the whole
app — worth knowing if you're comparing new mobile screenshots to anything
taken before this fix.

## What was verified

- `npm run build` — clean.
- Local smoke test: created tasks with start/due dates across all four
  views; reported a blocker against a task and a service-only blocker;
  resolved one; confirmed the resolved list and open-count badges update.
- Playwright screenshots, desktop (1440px) and mobile (390px), of List,
  Kanban, Gantt, Calendar, and the Blockers panel, plus a mobile/desktop
  re-check of `/` and `/documents` to confirm the shell fix has no
  regression on pages outside this phase's scope.
- `document.body.scrollWidth` checked at 390px on all four views — no
  horizontal page overflow (Gantt intentionally scrolls horizontally
  *within its own card* on narrow screens, rather than forcing the page
  wider, same pattern as a responsive data table).

## Known limitations / not done yet

- No un-resolve path for a blocker once marked resolved (deliberate —
  mirrors Documents' "closed is closed" pattern; revisit if staff want to
  reopen one by mistake).
- No drag-to-reschedule in Gantt/Calendar — dates are set via the existing
  "Set dates" control on a task.
- No dark-mode visual QA on the new Kanban/Gantt/Calendar CSS specifically.
- The mobile shell bug fixed here means any mobile screenshots from prior
  phases (taken before this fix) show the cramped ~190px layout — no
  functional regression from that, just not representative of the shell
  as it now renders.
