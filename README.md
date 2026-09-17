# VBP Navigator OS — v3.0 roadmap, Phase 9 "Cluster B: Workflow wiring"

This package closes six dead ends the v3.0 enhancement backlog called out under
"Workflow wiring" — places where the app recorded data but never *acted* on it.
Nothing here is a new module; it's the connective tissue between modules that
already existed.

## What's in this zip

25 files: 1 new migration, 5 changed `lib/` modules, 4 changed API routes, and
15 changed components. Every file replaces the file at the same path in your
project. No files are deleted or renamed.

```
supabase/migrations/0016_phase9_workflow_wiring.sql   (new)
lib/db-tasks.ts
lib/db-blockers.ts
lib/service-health.ts
lib/rollups.ts
lib/ai-context.ts
app/api/blockers/[id]/route.ts
app/api/classes/[id]/route.ts
app/api/tasks/route.ts
app/api/tasks/[id]/route.ts
app/tasks/page.tsx
app/budget/page.tsx
components/capabilities/types.ts
components/capabilities/HealthView.tsx
components/dashboard/DashboardView.tsx
components/tasks/types.ts
components/tasks/NewTaskForm.tsx
components/tasks/TaskItem.tsx
components/tasks/BlockersPanel.tsx
components/tasks/TaskBoard.tsx
components/budget/BudgetWorkspace.tsx
components/budget/ExpensesSection.tsx
components/budget/BudgetRequestsSection.tsx
components/budget/InvoicesSection.tsx
components/classes/ClassItem.tsx
components/service-requests/RequestItem.tsx
```

## Required: run the migration first

`supabase/migrations/0016_phase9_workflow_wiring.sql` adds one column:

```sql
alter table tasks add column if not exists service_request_id uuid
  references service_requests (id) on delete set null;
create index if not exists tasks_service_request_id_idx on tasks (service_request_id);
```

Run it against your Supabase Postgres database before (or immediately after)
deploying this code — item 4 (service request → task) needs the column to
exist. Everything else in this phase reuses columns that already existed
(including `invoices.class_id`, added back in migration 0006 and never used
until now).

Local SQLite (`dev.db`) doesn't need a manual step — `lib/db-tasks.ts`'s
`ensureSchema()` adds the column defensively on next server start, the same
pattern every prior phase has used for local dev databases.

## The six items

**1. Resolving a Blocker didn't touch its linked Task.**
`PATCH /api/blockers/[id]` now checks, after resolving a blocker, whether that
was the *last* open blocker on its linked task. If so, and the task is still
in its initial `open` status, the task is automatically advanced to
`in_progress`. The response carries `unblockedTaskId`/`unblockedTaskStatus`,
and the Tasks page shows a one-line confirmation: `"<title>" had no blockers
left, so it was moved to In progress automatically.`

Design decision, stated plainly: this does not invent a new "blocked" task
status. `lib/db-blockers.ts` already documents why Blockers exist as their own
first-class entity instead of being inferred from task state — adding a
"blocked" status would fight that design. The rule is narrow on purpose: it
only fires on the *open → in_progress* transition. A task already
`in_progress` or `done` is left alone (verified explicitly — see Testing
below), and a task with multiple blockers only advances once every one of
them is resolved.

**2. Classes could be marked "completed" with setup tasks still open.**
`PATCH /api/classes/[id]` now rejects `{status: "completed"}` with a 400 and
a message like `"Complete the setup checklist first — 3 tasks still open."`
whenever any of the class's auto-generated setup tasks isn't `done`. The
Classes page mirrors this client-side: the "Mark completed" button is
genuinely `disabled` (not just visually discouraged) when tasks are open, with
a tooltip and inline explanation.

**3. Class completion never created an Invoice.**
`invoices.class_id` existed since migration 0006 specifically for this and sat
unused. Now, when a class is marked completed, the UI offers an opt-in
checkbox ("Generate an outgoing invoice for this class when marked
completed") with Customer / Amount / Due-date fields. If checked and filled
in, the PATCH request includes an `invoice` payload and the API creates a
real `invoices` row linked via `classId`.

This follows the same discipline as every other money-related feature in this
app (payroll rates, budget/invoice amounts): the amount is always
staff-entered, never computed or invented. The feature is opt-in and off by
default — not every completed class bills a customer immediately, or at all.

**4. Service Requests were completely isolated.**
Each `RequestItem` now checks on mount whether a task already exists for it
(`GET /api/tasks?serviceRequestId=<id>`) and shows either a "Create task"
button or a `→ Task created` link to the filtered Tasks view. Creating a task
POSTs `{serviceId, serviceRequestId, title, description}` — the request's own
title/description seed the task, and the link is stored via the new
`tasks.service_request_id` column so a second click never creates a
duplicate.

**5. Service Health's `reasons[]` had no drill-down.**
`ServiceHealth.reasons` changed from `string[]` to `{text: string; href:
string | null}[]`. Reasons like "13 active items with nobody assigned" now
link to `/tasks?service=<id>` (or `&focus=overdue` for the overdue-specific
reason); the Capabilities Health tab and the Dashboard's at-risk list both
render these as real links when `href` is present.

Making the links land somewhere meaningful required adding service-scoped
filtering to `TaskBoard` and `BudgetWorkspace` (`?service=<id>`, plus
`&focus=overdue|blocked` on Tasks) — both pages now show a "Showing … for
<service> — Clear filter" banner. One reason, "No provider assigned," keeps
`href: null` on purpose: there's no service-detail page yet to link to. That's
a known, documented gap, not an oversight.

**6. Task `dependencies` were captured but never enforced.**

Correction worth stating plainly: the backlog's own wording said dependencies
were "captured at creation and rendered, but never enforced." On inspection
that wasn't accurate — a full-project search showed `dependencies` was never
accepted by `POST /api/tasks`, never settable from `NewTaskForm`, and never
rendered by `TaskItem`. It existed only in the type/schema layer and was
completely dead. So this item wasn't "add enforcement" — it was build the
missing feature first, then enforce it:

- `NewTaskForm` gained a "Depends on…" toggle revealing same-service tasks as
  checkboxes.
- `TaskItem` now shows a "Depends on: X ✓, Y ○" line and disables the
  in-progress/done buttons (with a tooltip) while any dependency isn't done.
- `PATCH /api/tasks/[id]` rejects an `in_progress`/`done` transition with a
  400 (`"Blocked by 2 unfinished dependencies: X, Y"`) if any listed
  dependency task isn't done yet.

Known gap: the Kanban view's drag-to-change-status path doesn't surface this
rejection the way the List view's buttons do (no tooltip, no inline error on
a rejected drag). This is a pre-existing pattern in this app — Kanban has
never surfaced List-view-style inline errors — not a regression introduced
here, but it's worth knowing about if you rely on Kanban for tasks with
dependencies.

## What was verified

- `npx tsc --noEmit` — clean.
- `npm run build` — clean; `/tasks` and `/budget` are still statically
  prerendered (`○` in the route table) despite now reading
  `useSearchParams()`, because both are wrapped in `<Suspense>` in
  `app/tasks/page.tsx` / `app/budget/page.tsx` (same pattern as the Customers
  page from the previous phase).
- A 22-assertion Node.js API-level smoke test against a freshly reset local
  SQLite database, covering all six items end-to-end, including negative
  cases (an already-in-progress task is *not* touched by a later blocker
  resolve; advancing a task with an unmet dependency is rejected; completing
  a class with open tasks is rejected) — 22/22 passed.
- Playwright screenshots at 1440px and 390px across Tasks (list + service
  filter + overdue filter), Classes (gating + invoice form), Service
  Requests, Capabilities → Health, Dashboard, and Budget (service filter) —
  no horizontal overflow (`body.scrollWidth` matched the viewport exactly)
  and every new UI element (filter banners, dependency chips, gating
  messages, create-task/task-created states, reason links) rendered
  correctly on both sizes.

## Applying this

Same process as every prior phase: copy these files over the matching paths
in your local checkout via GitHub Desktop, run the migration against
Supabase, commit, and push — Vercel auto-deploys.
