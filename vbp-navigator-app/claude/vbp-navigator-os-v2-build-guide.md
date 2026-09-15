# VBP Navigator OS v2.0 — Build Guide / To-Do

Started 2026-09-15. This is the working checklist for actually building
v2.0 — the decisions live in `vbp-navigator-os-v2-alignment.md`, this doc
tracks what's built vs. not, phase by phase, so any session (this one or
a future one) can see status at a glance without re-reading the whole
alignment doc. Update this doc's checkboxes as work completes — don't let
it drift out of sync with the actual codebase.

Codebase: `mavube/vbp-navigator` on GitHub, standalone Next.js app.

## Phase 1 — Foundation (in progress)

Goal: multi-tenant data model, real auth, design system core, PWA shell —
nothing user-facing-new yet, so every later phase is additive, not a
rewrite. Per the alignment doc Section 11.

- [x] Multi-tenant schema (`supabase/migrations/0001_foundation_schema.sql`) — organizations, profiles, role_assignments, services, findings, all `org_id`-scoped.
- [x] Row-Level Security (`supabase/migrations/0002_foundation_rls.sql`) — `current_org_id()` / `has_role()` helpers, policies on all 5 foundation tables.
- [x] Supabase Auth wired in — `lib/supabase/{client,server,middleware}.ts`, `proxy.ts` now gates on a signed-in user instead of the old shared passcode, `/login` is a real sign-in form, `/auth/signout` route added.
- [x] Role model constants (`lib/roles.ts`) — the 6 roles from the alignment doc, `isOrgWideRole()` helper.
- [x] `findings` retrofitted to be org-scoped (`lib/db.ts`, both API routes, `lib/current-org.ts`) — verified working end-to-end (build + local smoke test: GET/PATCH both confirmed against a running instance).
- [x] Design system core — `styles/design-tokens.css` (new `--v2-*` tokens, separate from v1.0's `globals.css` so old screens don't regress), `styles/components.css`, and `components/ui/{Button,Card,Badge,Input,VersionBadge}.tsx`.
- [x] Visible version badge — `components/ui/VersionBadge.tsx`, mounted in `app/layout.tsx`, reads "VBP Navigator OS · v2.0" on every page.
- [x] PWA shell — `public/manifest.json`, `public/sw.js`, `components/ServiceWorkerRegister.tsx`, manifest/icon links in `app/layout.tsx`. Verified: manifest, service worker, and icons all serve with 200s.
- [x] `package.json` — added `@supabase/ssr` + `@supabase/supabase-js`, bumped to `2.0.0-foundation`.
- [x] `.env.example` and README updated for the new setup (Supabase project, migrations, env vars, manual org/role bootstrap SQL since there's no invite flow yet).
- [x] Build verified clean (`npm run build`), local smoke test verified (server starts, `/`, `/api/findings` GET+PATCH, `/manifest.json`, `/sw.js`, `/icons/icon-192.png` all correct).

**Not done yet — needed before this phase is fully "live," not just code-complete:**
- [ ] Diallo creates an actual Supabase project and runs the two migration files (README "v2.0 Foundation setup" has the exact steps).
- [ ] Bootstrap VBP's org + the 5 people's accounts/roles via the SQL in that same README section (or wait for a real invite flow — see below).
- [ ] Real brand icons — `public/icons/*.png` are placeholder-generated (blue square, "VBP" text), not VBP's actual mark.
- [ ] A real invite flow (Org Admin invites by email from the app) — right now new accounts are created by hand in the Supabase dashboard. Reasonable to build alongside a later phase rather than blocking on it.
- [ ] `components/ServiceCards.tsx` (the v1.0 Service Architecture tab) still renders hardcoded JSX rather than reading the `services` table. Phase 2 added *read* access to `services` (`app/api/services/route.ts`) for the Tasks module, but didn't touch this v1.0 component — still open.

## Phase 2 — Processes (Tasks) — done

`Task` entity: `serviceId`, title, description, status (open/in_progress/done), assignee, due date, `dependencies[]`. First feature module — proves out the `serviceId` discipline and the v2.0 design system on real data.

- [x] `tasks` table + RLS (`supabase/migrations/0003_phase2_tasks.sql`) — org-scoped, service-scoped, status check constraint.
- [x] `services` read access (`lib/db-services.ts`, `app/api/services/route.ts`) — local-dev auto-seeds 2 demo services; a real org seeds VBP's actual 10-service catalog via `supabase/seed/vbp_services.sql` (placeholders for org/profile ids, since those only exist after the Foundation bootstrap).
- [x] Task list UI (`/tasks` — `app/tasks/page.tsx`, `components/tasks/{TaskBoard,NewTaskForm,TaskItem}.tsx`) using the `components/ui` primitives — a flat list grouped implicitly by the service tag on each card, not a full kanban board. A drag-drop board is a reasonable later upgrade, not needed to validate the workflow.
- [x] Permissions: any org member can create a task; only that service's Service Owner/Contributor or an Org Admin can change its status — enforced in `app/api/tasks/[id]/route.ts` via `lib/permissions.ts` (app-level, since the API routes connect via `DATABASE_URL` rather than a per-user Supabase session — RLS on `tasks` mirrors the same rule as a second line of defense for any Supabase-client code path).
- [x] Shared driver code factored out (`lib/db-driver.ts`) so `lib/db.ts`, `lib/db-services.ts`, and `lib/db-tasks.ts` don't each reimplement Postgres/SQLite setup — also where the RLS-vs-app-filtering architecture note now lives, since it applies to all three.
- [x] Build verified clean, local smoke test verified end-to-end: list services (auto-seeded demo data), create a task, list tasks, PATCH status to `in_progress`, confirm `/tasks` page renders.

**Not done yet:**
- [ ] Diallo runs `supabase/seed/vbp_services.sql` (needs the Foundation bootstrap done first) so the real org has its actual service catalog instead of relying on local demo data.
- [ ] Board/kanban view, if a flat list turns out to not be enough once there's real task volume.

## Phase 3 — Pipeline (Leads) — done

Tied to the two gap CVS (Professional Readiness Assessment, Candidate Admission) — concrete progress against Findings 3/4.

- [x] `leads` table + RLS (`supabase/migrations/0004_phase3_pipeline.sql`) — stage enum (`new`/`contacted`/`assessed`/`admitted`/`lost`), same org/service-scoping pattern as `tasks`.
- [x] Pipeline UI (`/pipeline` — `app/pipeline/page.tsx`, `components/pipeline/{PipelineBoard,NewLeadForm,LeadItem}.tsx`) — active vs. closed leads, stage-advance buttons. Same design-system components and permission model as Tasks (`lib/permissions.ts`'s `canManageService` is reused as-is, not duplicated).
- [x] Deliberately no automatic service hand-off when a lead crosses from assessment to admission — that would mean hardcoding VBP-specific service ids into application logic, which breaks for a future tenant with a different catalog. Advancing a lead's owning service is a manual edit, same picker UX as choosing a task's service.
- [x] Build verified clean, local smoke test verified end-to-end: create a lead, list leads, advance stage, confirm an invalid stage is rejected, confirm `/pipeline` renders and the nav link shows.

**Not done yet:**
- [ ] Real leads against VBP's actual Readiness Assessment / Candidate Admission services once `supabase/seed/vbp_services.sql` has been run.

## Phase 4 — Classes — done

Instances of Master Class Delivery; scheduling one auto-generates a linked Task[] (a standard setup checklist), each tagged to the class's own service.

- [x] `classes` table + RLS (`supabase/migrations/0005_phase4_classes.sql`) — status enum (`scheduled`/`in_progress`/`completed`/`cancelled`), same org/service-scoping pattern as tasks and leads. Also adds a nullable `class_id` column to `tasks` (`alter table ... add column if not exists`) so a task can optionally belong to the class that generated it.
- [x] Class creation flow that generates tagged Tasks — `lib/db-classes.ts`'s `createClass` inserts the class row, then calls `lib/db-tasks.ts`'s `createTask` once per entry in `STANDARD_SETUP_TASKS` (Confirm venue and schedule / Prepare training materials and equipment / Confirm enrolled candidate list / Brief instructor / Schedule post-class evaluation), each tagged with `classId` **and** the class's own `serviceId`.
- [x] Deliberately every generated setup task is tagged to the class's *own* service, not fanned out across other services (e.g. a venue task tagged to Operational Support). The earlier v1.0 prototype's checklist did span departments, but re-pointing that at specific service IDs would mean hardcoding VBP-specific service references into application logic — the same multi-tenancy trap avoided in Pipeline's no-auto-transition decision (Phase 3). Documented in `lib/db-classes.ts`'s file header.
- [x] `lib/db-tasks.ts` extended (not duplicated) to carry an optional `classId` — `listTasks` now also accepts a `classId` filter, used by the Classes UI to show each class's checklist and by `app/api/tasks/route.ts`'s `GET` (`?classId=`).
- [x] Classes UI (`/classes` — `app/classes/page.tsx`, `components/classes/{ClassBoard,NewClassForm,ClassItem}.tsx`) — scheduling form, status-advance buttons, and each class card shows its live setup checklist with per-task checkboxes (PATCH `/api/tasks/:id`, same status endpoint Tasks uses).
- [x] Permissions: same model as Tasks/Leads — any org member can schedule a class; only that service's Service Owner/Contributor or an Org Admin can change its status (`app/api/classes/[id]/route.ts` via `lib/permissions.ts`, RLS on `classes` as the second line of defense).
- [x] Build verified clean, local smoke test verified end-to-end: schedule a class (confirmed all 5 setup tasks generated, correctly tagged with both `classId` and `serviceId`), list classes, advance status to `in_progress`, confirm an invalid status is rejected, mark one setup task done and confirm it persists, confirm plain (non-class) task creation and existing `serviceId` filtering on `/api/tasks` still work unchanged, confirm `/classes` renders and the nav link shows.

**Not done yet:**
- [ ] Real classes against VBP's actual Master Class Delivery service once `supabase/seed/vbp_services.sql` has been run.
- [ ] Outgoing Invoice[] linked to a Class (billing the customer org for that class) — deferred to Phase 5, per the data model diagram in the alignment doc Section 8.

## Phase 5 — Budget + Compensation Earning Service — done

The big one — see alignment doc Sections 6–7 for full detail.

- [x] `budget_requests`, `quotations`, `expenses`, `invoices` (with `direction: incoming|outgoing`) tables + RLS (`supabase/migrations/0006_phase5_budget.sql`). Every one of these carries a required `service_id` per the core discipline (Section 2) — Quotation is the one exception, since it's a sub-record of a Budget Request that already has one.
- [x] Budget Approver routing (org-wide — Anne at VBP) wired to the `budget_approver` role — `lib/db-budget.ts`'s `getOrgBudgetApproverId` defaults a new request's `approverId` to whoever holds that org-wide role; `lib/permissions.ts`'s new `canApproveBudget` gates the actual approve/reject PATCH (`app/api/budget-requests/[id]/route.ts`) and doubles as the Compensation finalize gate.
- [x] `compensation_entries` table (Basic Pay, allowances[], deductions[], computed Net Pay) + `compensation_rate_configs` (per-org statutory rates) + RLS (`supabase/migrations/0007_phase5_compensation.sql`).
- [x] Statutory deduction rules **configurable per-org**, not hardcoded — `lib/payroll.ts` is a pure, dependency-free module (`computePaye`, `computeCompensation`) that takes a `RateConfig` as input; `lib/db-compensation.ts`'s `getRateConfig` reads an org's `compensation_rate_configs` row (auto-seeding `DEFAULT_RATE_CONFIG` on first use, same pattern as demo services). The illustrative Tanzania default rates are flagged in both files as a starting point to verify, not authoritative tax figures.
- [x] `scripts/verify-payroll.ts` — a standalone hand-worked regression check (progressive PAYE across brackets, a full entry's gross/deductions/net) confirming the math, not just that it runs. `npx tsx scripts/verify-payroll.ts`.
- [x] Compensation Earning Service ownership (Jennifer runs, Anne approves) modeled in permissions, not hardcoded to those two people: creating a draft entry requires managing the service (`canManageService`); finalizing requires the org-wide Budget Approver (`canApproveBudget`) — whoever holds those roles for a given tenant.
- [x] Finalizing a compensation entry generates a real linked Expense against its own service (`lib/db-compensation.ts`'s `finalizeCompensationEntry`, calling into `lib/db-expenses.ts`) — Expense amount is gross pay (basic + allowances), the org's actual cash outlay, since the deduction lines are withheld and remitted on the employee's behalf, not kept. Documented inline as a deliberate choice, since the alignment doc's diagram doesn't spell out which figure to feed Budget.
- [x] Outgoing invoices generate against a Class/Lead with no approval step (confirmed in alignment doc) — `invoices.class_id` / `invoices.lead_id` are both nullable FKs, `direction` decides whether an approval chain would even apply (it never does — see Section 6).
- [x] Budget UI (`/budget` — `app/budget/page.tsx`, `components/budget/*`) — tabbed Requests / Expenses / Invoices workspace; a Budget Request card shows its quotations inline with an add-quote mini-form, and Approve/Reject buttons that only succeed for the org's Budget Approver (errors surface inline for anyone else, same UX pattern as Tasks/Leads/Classes).
- [x] Compensation UI (`/compensation` — `app/compensation/page.tsx`, `components/compensation/*`) — a form with dynamic allowance rows, and each entry card shows the full breakdown (basic → gross → deductions → net) plus a Finalize button.
- [x] Validate: a full pay period actually computes Net Pay correctly for a sample employee under Tanzania's rates — verified two ways: `scripts/verify-payroll.ts`'s hand-worked numbers, and a live smoke test (basicPay 1,000,000 + Housing 200,000 → gross 1,200,000, NSSF 120,000, PAYE 152,000, net 928,000 — both agree), plus confirmed finalizing generated the linked Expense at gross pay (1,200,000) and it showed up in `/api/expenses`.
- [x] Build verified clean, local smoke test verified end-to-end: budget request created → quotation attached → approved; invalid status rejected; expense logged; outgoing and incoming invoices created, filtered by `?direction=`, marked paid; compensation draft created with correct computed deductions/net pay; finalized and confirmed the generated Expense; confirmed Tasks/Pipeline/Classes creation and their pages are unaffected by the new modules.

**Not done yet:**
- [ ] Real budget requests/expenses/invoices/compensation entries against VBP's actual service catalog and real people once `supabase/seed/vbp_services.sql` and the org bootstrap have been run.
- [ ] A rate-editing UI for `compensation_rate_configs` — currently edited by hand in SQL, same as the services catalog before Phase 2. Worth prioritizing before this goes live, since the seeded rates are illustrative only (see `lib/payroll.ts`'s file comment).
- [ ] Confirm current NSSF/WCF/PAYE figures with the relevant Tanzanian authorities before relying on the seeded defaults for a real pay run.

## Phase 6 — Service Requests + Collaboration

Not started. Grouped together since Collaboration's main use is commenting on tickets/tasks.

- [ ] `service_requests` table + RLS
- [ ] Polymorphic `comments`/`activity` table (`entity_type`, `entity_id`) + RLS

## Phase 7 — Capabilities/Workload + Outcomes metrics

Not started. Reporting/rollup layer — makes most sense once there's real task/ticket/budget/compensation data to aggregate.

- [ ] Workload view per person/service
- [ ] Outcomes fields become real numbers, not just sentences

## Cross-cutting, ongoing (not a phase — applies throughout)

Per alignment doc Section 12:

- [ ] API connector (API-key based, paste-a-key integration) — design pass once Foundation's auth model is settled (it is now — worth scheduling this design pass before Phase 2 gets deep)
- [ ] Mobile/responsive pass on every new screen, not deferred to the end
- [ ] Clean, human-readable, short-file code discipline (this is also a saved project preference, not just here)
- [ ] Each module's workflow actually tested against a real scenario before being called done
