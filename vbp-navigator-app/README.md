# VBP Navigator OS

A standalone, self-hosted Next.js app built on the ValueBlueprint® method.
**v1.0** (Sept 2026) shipped the Service & Value Architecture map of VBP's
own operation, plus the GDC PMP Master Class reference case. **v2.0** is in
progress: a full service-management platform (multi-tenant SaaS + internal
tool) — see `claude/vbp-navigator-os-v2-alignment.md` and
`claude/vbp-navigator-os-v2-build-guide.md` in the project for the full
plan. This README documents both — sections below say which version they
describe.

## v2.0 status: Foundation through Phase 6 (Service Requests + Collaboration)

Foundation (multi-tenant data model, Supabase Auth, design system core,
PWA shell) is in — see **"v2.0 Foundation setup"** below. **Phase 2
(Processes/Tasks)**, **Phase 3 (Pipeline/Leads)**, **Phase 4 (Classes)**,
**Phase 5 (Budget + Compensation Earning Service)**, and **Phase 6
(Service Requests + Collaboration)** are also in — see their sections
below. Remaining: Phase 7 (Capabilities/Workload + Outcomes metrics),
the last one on the roadmap. Full roadmap:
`claude/vbp-navigator-os-v2-build-guide.md`.

## What's here

- **Next.js 16 (App Router) + TypeScript**, single-page app with two tabs
  (Internal Operation / GDC reference case), same "blueprint" visual design
  as the original artifact.
- **A small findings-tracking backend** — the four findings (IT-label
  overload, Jennifer's concentration risk, Anne's dual-role risk, the
  unowned Candidate Admission service) are stored in a real database with a
  status (Open/Confirmed/Resolved) and a note per finding, editable by
  anyone with the link, syncing across everyone with the page open (polling
  every 4 seconds — see "Why polling, not websockets" below).
- **No ORM** — a ~130-line hand-rolled data layer (`lib/db.ts`) that talks
  to either SQLite (local dev, zero setup) or Postgres (production),
  chosen automatically from `DATABASE_URL`. This sidesteps Prisma's
  native-binary download step, which fails in some sandboxed/offline build
  environments.
- **Real per-user auth via Supabase** (v2.0 — replaces v1.0's shared
  passcode; see "v2.0 Foundation setup" below). Off by default (open
  access, single local org) until you set the Supabase env vars.

## Local development

```bash
npm install
cp .env.example .env       # DATABASE_URL defaults to a local SQLite file
npm run dev
```

Open http://localhost:3000. The four findings are seeded automatically on
first request — nothing to run by hand.

Local dev's SQLite path requires **Node.js 22.5+** (it uses Node's built-in
`node:sqlite`, still flagged experimental upstream but stable enough for
this). Check with `node -v`; if you're on an older Node, either upgrade or
point `DATABASE_URL` at a real Postgres database even for local dev (see
below — works identically either way).

## v2.0 Foundation setup (Supabase Auth + multi-tenant schema)

Everything above still works with zero setup — leave the Supabase env
vars unset and the app runs open, single-org, exactly like v1.0. To turn
on real accounts, roles, and row-level tenant isolation:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine to start).
2. **Run the migrations** — open the project's SQL Editor and run, in order:
   - `supabase/migrations/0001_foundation_schema.sql`
   - `supabase/migrations/0002_foundation_rls.sql`
   - `supabase/migrations/0003_phase2_tasks.sql`
   - `supabase/migrations/0004_phase3_pipeline.sql`
   - `supabase/migrations/0005_phase4_classes.sql`
   - `supabase/migrations/0006_phase5_budget.sql`
   - `supabase/migrations/0007_phase5_compensation.sql`
   - `supabase/migrations/0008_phase6_service_requests.sql`
   - `supabase/migrations/0009_phase6_collaboration.sql`
   (or `supabase db push` with the Supabase CLI, if you have a project linked).
3. **Set env vars** (`.env` locally, or your host's dashboard in production) — from the Supabase project's Settings → API:
   ```
   DATABASE_URL="postgres://...."               # Settings → Database → Connection string
   NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
   SUPABASE_SERVICE_ROLE_KEY="eyJ..."
   ```
4. **Create the first user and bootstrap VBP's org.** There's no self-serve sign-up yet (an Org Admin creates accounts — see the build guide's Phase 2+ notes for a real invite flow). For now:
   - In the Supabase dashboard, Authentication → Users → **Add user**, create Diallo's account (email + password).
   - In the SQL Editor, run:
     ```sql
     insert into organizations (name, slug) values ('VBP', 'vbp') returning id;
     -- copy the returned id, then:
     insert into profiles (id, org_id, full_name, email)
       values ('<the new user''s auth.users id>', '<the org id above>', 'Diallo', 'diallo@example.com');
     insert into role_assignments (org_id, user_id, role)
       values ('<org id>', '<user id>', 'org_admin');
     ```
   - Repeat the `profiles` + `role_assignments` inserts for Jennifer, Anne, Edwin, and Twesa once each has a Supabase Auth user — their roles are in `claude/vbp-navigator-os-v2-alignment.md` Section 4 (e.g. Anne gets both `service_owner` on her services and the org-wide `budget_approver` role).
5. Visit `/login` and sign in. `proxy.ts` now requires a signed-in user for every route except `/login`.

## Phase 2: Tasks

`/tasks` — create a task against any service, change its status
(Open/In progress/Done). Every task requires a `serviceId`; there's no
"unassigned" state, per the core discipline in the alignment doc.

- **Local dev (no Supabase):** works immediately — two demo services are
  auto-seeded on first run so the task form has something to pick from.
- **Real org:** the `services` table starts empty. Run
  `supabase/migrations/0003_phase2_tasks.sql`, then seed VBP's actual
  10-service catalog with `supabase/seed/vbp_services.sql` (find-and-replace
  the `<VBP_ORG_ID>` / `<JENNIFER_PROFILE_ID>` / etc. placeholders with
  the real ids from your org + profiles bootstrap first).
- **Permissions:** anyone signed in can create a task against any
  service (matches how a team actually logs work). Only that service's
  Service Owner/Contributor, or an Org Admin, can change a task's status —
  enforced both in `app/api/tasks/[id]/route.ts` (the code path that
  actually runs, since it connects via `DATABASE_URL` rather than a
  per-user Supabase session — see `lib/db-driver.ts`'s comment) and
  mirrored in the RLS policy for anyone querying via the Supabase client
  directly.

## Phase 3: Pipeline

`/pipeline` — leads move through `new → contacted → assessed → admitted`
(or `lost` at any point before `admitted`). Tied to the two currently
unowned CVS from `vbp-internal-service-architecture.md` (Professional
Readiness Assessment, Candidate Admission) — a lead's `serviceId` says
which of those (or any service) currently owns it; moving a lead from
assessment to admission is a matter of creating/editing which service it
points at, the same picker pattern as Tasks. No automatic service
hand-off is built in on purpose — hardcoding "assessment's service id
becomes admission's service id" would only work for VBP's specific
catalog and breaks the moment another tenant has different service ids.

Same permission shape as Tasks: anyone can log a lead, only that
service's Service Owner/Contributor or an Org Admin can advance its
stage (`supabase/migrations/0004_phase3_pipeline.sql` + `lib/permissions.ts`).

## Phase 4: Classes

`/classes` — schedule a class (an instance of Master Class Delivery, or
any service) and it auto-generates a standard 5-item setup checklist as
real Tasks: confirm venue and schedule, prepare training materials and
equipment, confirm enrolled candidate list, brief instructor, schedule
post-class evaluation. Each checklist item is tagged with both the
class's `serviceId` and a `classId` linking it back to the class, and
shows up right on the class's card with a checkbox — checking it PATCHes
the same `/api/tasks/:id` endpoint Tasks uses, so it's a real task, not a
separate concept. A class also moves through its own status:
`scheduled → in_progress → completed`, or `cancelled` at any point.

Every generated checklist item is tagged to the class's *own* service —
deliberately not fanned out across other services (e.g. a venue task
tagged to Operational Support, a materials task tagged to Digital &
Information Enablement), even though the earlier v1.0 prototype's
checklist did span departments that way. Re-pointing that at specific
service ids would mean hardcoding VBP-specific service references into
application logic, breaking for any tenant with a different catalog —
the same reasoning behind Pipeline's no-auto-transition decision
(Phase 3). See `lib/db-classes.ts`'s file comment.

Same permission shape as Tasks and Pipeline: anyone can schedule a
class, only that service's Service Owner/Contributor or an Org Admin
can change its status (`supabase/migrations/0005_phase4_classes.sql` +
`lib/permissions.ts`).

## Phase 5: Budget + Compensation Earning Service

`/budget` — a tabbed workspace for the full spend/revenue picture, per
the alignment doc Section 6:

- **Budget requests** — anyone can submit one (petty cash or direct,
  tagged to a service and a purpose/amount). Approving or rejecting is
  restricted to the org's single, org-wide **Budget Approver** role
  (Anne at VBP) or an Org Admin, regardless of which service the
  request is against — `lib/permissions.ts`'s `canApproveBudget`. Each
  request can carry vendor quotations (added inline on its card).
- **Expenses** — actual recorded spend, `serviceId`-tagged, optionally
  linked back to the budget request it was spent against. Logging one
  is restricted to that service's owner/contributor or an Org Admin
  (unlike a request, this is a real cash outlay being recorded).
- **Invoices** — both directions: **incoming** (a vendor's bill to
  VBP) and **outgoing** (VBP billing a customer, e.g. training fees).
  Outgoing invoices need no approval chain — this is revenue, not
  spend, confirmed in the alignment doc. Both directions share one
  table (`direction` column) and the same permission gate as Expenses.

`/compensation` — the Compensation Earning Service, VBP's 5th Enabling
Service and real payroll computation rather than an Expense category
(alignment doc Section 7): Basic Pay + Allowances − Deductions = Net
Pay, computed server-side from the org's configured statutory rates
(`lib/payroll.ts`, a pure/testable module — see `scripts/verify-payroll.ts`
for a hand-worked regression check you can re-run any time:
`npx tsx scripts/verify-payroll.ts`). Rates (NSSF, WCF, PAYE brackets)
live in `compensation_rate_configs`, one row per org, seeded with an
**illustrative Tanzania default that still needs verifying against
current NSSF/TRA figures before a real pay run** — there's no
rate-editing UI yet, so adjust that table directly in SQL.

Creating a draft entry is gated to the Compensation Earning Service's
owner/contributor (Jennifer, per Section 7) or an Org Admin.
**Finalizing** an entry is the approval step — restricted to the
org-wide Budget Approver (Anne) or an Org Admin, same gate as approving
a Budget Request — and it also generates a real linked Expense against
the Compensation Earning Service, at gross pay (the organization's
actual cash outlay, since the deduction lines are withheld and remitted
on the employee's behalf rather than kept) — see
`lib/db-compensation.ts`'s file comment for the reasoning.

## Phase 6: Service Requests + Collaboration

`/service-requests` — ITSM-style requests and incidents, each with a
`type` (request/incident), `priority` (low/medium/high/urgent), and
`status` (open → in_progress → resolved → closed). Submitting one is
open to anyone — Requester is the default role for any staff member
(alignment doc Section 4) — moving it through status is gated to that
service's owner/contributor or an Org Admin, same shape as Tasks.

Collaboration isn't a separate page — it's one reusable component,
`components/collaboration/CommentThread.tsx`, embedded directly on
whatever it's about: a Task card, a Lead, a Class, a Budget Request, a
Service Request. Per the vision doc, this is deliberate — "collaboration
lives where the work is, not in a separate chat surface." The backing
table (`comments`) is polymorphic: `entity_type` + `entity_id` instead
of a dozen near-identical `task_comments` / `lead_comments` tables, so a
future module can host a thread just by picking a consistent
`entity_type` string, no schema change required.

A comment's byline is resolved server-side from the signed-in user's
own session when one exists (`lib/permissions.ts`'s `resolveDisplayName`)
so nobody can post as someone else; local dev, with no session to
resolve, trusts whatever name is typed into the form — same trust
model as every other local-dev permission check in this app.

## Deploying

The app is a standard Next.js app — deploy it anywhere Next.js runs
(Vercel, Netlify, Render, a plain Node server, Docker). Vercel is the path
of least resistance since Next.js is built by the same company:

1. Push this project to a GitHub repo, then import it at
   [vercel.com/new](https://vercel.com/new) — or run `npx vercel` from this
   directory if you'd rather deploy without GitHub.
2. **Set up a real database.** SQLite's on-disk file does not survive
   across serverless invocations, so production needs Postgres. The
   easiest free options that just need a connection string:
   - [Neon](https://neon.tech) — serverless Postgres, generous free tier.
   - [Supabase](https://supabase.com) — Postgres + a dashboard, also has a
     free tier.
   - Vercel's own "Storage → Postgres" tab in your project, if you're
     already deploying there.
3. In your deployment's environment variables, set `DATABASE_URL` (the
   `postgres://...` connection string from step 2) plus the three
   Supabase auth vars — see "v2.0 Foundation setup" above, which doubles
   as the production setup guide since Supabase is now both the database
   and the auth provider.
4. Run all `supabase/migrations/*.sql` files, in numeric order, against
   that database if you haven't already (they're idempotent — safe to
   re-run).
5. Deploy.

Nothing else in the app is Vercel-specific; the same two env vars are all
any host needs.

## Why polling, not websockets

The original Claude Artifact used a realtime shared-document capability
built into that platform. A plain Next.js app doesn't have that for free,
and adding websockets (or a service like Pusher/Ably) is real
infrastructure for a page that four or five people check occasionally —
not proportional to the problem. Each open tab polls `/api/findings` every
4 seconds, which is "live enough" for a status/notes board like this
without the operational overhead. If usage grows to something more
real-time (many people editing simultaneously, minute-to-minute urgency),
swapping the polling in `components/Findings.tsx` for
[Supabase Realtime](https://supabase.com/docs/guides/realtime) or a
websocket is a contained change — it doesn't touch the schema or the API
route contracts.

## Project structure

```
app/
  page.tsx                — renders <NavigatorApp /> (v1.0 Service Architecture view)
  layout.tsx               — root HTML shell; loads v1.0 + v2.0 styles, PWA meta, top nav, version badge
  globals.css               — v1.0's "blueprint" design system (unchanged, still used by NavigatorApp)
  login/page.tsx             — v2.0: Supabase email/password sign-in
  auth/signout/route.ts       — v2.0: signs out, redirects to /login
  tasks/page.tsx                — v2.0 Phase 2: the Tasks page
  pipeline/page.tsx               — v2.0 Phase 3: the Pipeline page
  classes/page.tsx                  — v2.0 Phase 4: the Classes page
  budget/page.tsx                     — v2.0 Phase 5: the Budget page (requests/expenses/invoices)
  compensation/page.tsx                 — v2.0 Phase 5: the Compensation Earning Service page
  service-requests/page.tsx               — v2.0 Phase 6: the Service Requests page
  api/
    findings/route.ts          — GET all findings for the caller's org (auto-seeds)
    findings/[id]/route.ts      — PATCH one finding's status/note, scoped to org
    services/route.ts            — GET the caller's org's service catalog
    tasks/route.ts                 — GET (list, optional ?serviceId=/?classId=) / POST (create) tasks
    tasks/[id]/route.ts              — PATCH a task's status (Service Owner/Contributor/Org Admin only)
    leads/route.ts                    — GET (list, optional ?serviceId=) / POST (create) leads
    leads/[id]/route.ts                 — PATCH a lead's stage (same permission gate as tasks)
    classes/route.ts                      — GET (list, optional ?serviceId=) / POST (schedule + generate setup Tasks)
    classes/[id]/route.ts                   — PATCH a class's status (same permission gate as tasks)
    budget-requests/route.ts                  — GET (list) / POST (submit — anyone in the org)
    budget-requests/[id]/route.ts               — PATCH approve/reject (org-wide Budget Approver only)
    budget-requests/[id]/quotations/route.ts      — GET/POST vendor quotations on a request
    expenses/route.ts                               — GET (list) / POST (record spend — service owner/contributor)
    invoices/route.ts                                 — GET (list, ?direction=) / POST (create, either direction)
    invoices/[id]/route.ts                              — PATCH status (unpaid/paid/overdue)
    compensation/route.ts                                 — GET (list) / POST (create draft entry, computes Net Pay)
    compensation/[id]/route.ts                              — PATCH finalize (Budget Approver only; generates an Expense)
    service-requests/route.ts                                 — GET (list) / POST (submit — anyone in the org)
    service-requests/[id]/route.ts                              — PATCH status (Service Owner/Contributor/Org Admin only)
    comments/route.ts                                             — GET (?entityType=&entityId=) / POST (post a comment — anyone)
components/
  NavigatorApp.tsx          — tabs, layout, all static copy for both v1.0 tabs
  InternalChain.tsx          — the internal-ops service-chain SVG diagram
  GdcChain.tsx                 — the GDC reference-case SVG diagram
  ServiceCards.tsx               — CVS/Enabling service cards + provider table (still static JSX — see build guide)
  GdcTable.tsx                     — GDC department→service table
  Findings.tsx                       — the interactive, polling-synced findings
  ServiceWorkerRegister.tsx           — v2.0: registers the PWA service worker
  ui/                                  — v2.0 design system components (Button, Card, Badge, Input, VersionBadge, TopNav)
  tasks/                                 — v2.0 Phase 2: TaskBoard, NewTaskForm, TaskItem, types
  pipeline/                               — v2.0 Phase 3: PipelineBoard, NewLeadForm, LeadItem, types
  classes/                                  — v2.0 Phase 4: ClassBoard, NewClassForm, ClassItem (embeds the setup checklist), types
  budget/                                     — v2.0 Phase 5: BudgetWorkspace (tabs) + Requests/Expenses/Invoices sections, types
  compensation/                                 — v2.0 Phase 5: CompensationBoard, NewEntryForm, EntryItem (shows the full breakdown), types
  service-requests/                               — v2.0 Phase 6: RequestBoard, NewRequestForm, RequestItem, types
  collaboration/
    CommentThread.tsx                               — v2.0 Phase 6: the one reusable comment-thread component, embedded across Tasks/Leads/Classes/Budget Requests/Service Requests
lib/
  db-driver.ts       — shared Postgres/SQLite connection setup + the RLS-vs-app-filtering note (read this first)
  db.ts                — findings data layer, now org-scoped
  db-services.ts         — read access to the services table (+ local-dev demo seed)
  db-tasks.ts               — the tasks table's data layer (also carries the optional classId link)
  db-leads.ts                 — the leads table's data layer
  db-classes.ts                 — the classes table's data layer; createClass also generates the standard setup Task[]
  db-budget.ts                    — budget_requests + quotations data layer; getOrgBudgetApproverId defaults a request's approver
  db-expenses.ts                    — the expenses table's data layer
  db-invoices.ts                      — the invoices table's data layer (both directions)
  db-compensation.ts                    — compensation_rate_configs + compensation_entries; finalize also creates the linked Expense
  payroll.ts                              — pure Net Pay / progressive PAYE math, no DB — see scripts/verify-payroll.ts
  db-service-requests.ts                    — the service_requests table's data layer
  db-comments.ts                              — the polymorphic comments table's data layer (entity_type + entity_id)
  permissions.ts               — app-level role checks (mirrors the RLS policies for the DATABASE_URL code path); canApproveBudget gates Budget/Compensation approval, resolveDisplayName resolves a comment/request byline from the session
  findings-data.ts    — the fixed title/body copy for the 4 seeded findings
  current-org.ts        — resolves the signed-in user's org (or "local-dev" if Supabase isn't configured)
  roles.ts                — the six v2.0 role constants (see the alignment doc Section 4)
  supabase/
    client.ts                — browser Supabase client
    server.ts                  — server Supabase client (route handlers, server components)
    middleware.ts                — session refresh used by proxy.ts
styles/
  design-tokens.css   — v2.0 design tokens (--v2-* — separate from v1.0's globals.css tokens)
  components.css        — v2.0 component styles (.v2-btn, .v2-card, .v2-badge, .v2-input)
supabase/
  migrations/           — the multi-tenant schema + RLS policies; run these against your Supabase project, in order
  seed/vbp_services.sql   — VBP's real 10-service catalog (placeholders to fill in — see "Phase 2: Tasks")
scripts/
  verify-payroll.ts   — standalone hand-worked regression check for lib/payroll.ts (`npx tsx scripts/verify-payroll.ts`)
public/
  manifest.json, sw.js, icons/  — PWA shell (icons are placeholders — swap for real brand assets)
proxy.ts    — v2.0: requires a signed-in Supabase user (Next 16's "middleware" rename)
```

## Extending this

**This is now v2.0 scope, not v1.0's.** The original v1.0 brief kept this
deliberately small (no task manager, no ERP, no ticketing) — v2.0
reverses that: it's becoming a full service-management platform (Tasks,
Pipeline, Budget, Compensation, Service Requests, and more), still under
the same no-silos, `serviceId`-first discipline. See
`claude/vbp-navigator-os-v2-alignment.md` for what and why, and
`claude/vbp-navigator-os-v2-build-guide.md` for the phased build order
and current status. Two things worth doing soon, both natural follow-ons
to this Foundation phase:

1. **Move `services` from static JSX into the database.** The
   `services` table already exists (this migration) but
   `components/ServiceCards.tsx` still renders hardcoded cards. Wiring
   NavigatorApp to read/write real `services` rows is what makes the
   Service Owner / Contributor roles mean something in the UI, not just
   in the schema.
2. **A real invite flow**, replacing the manual SQL bootstrap in "v2.0
   Foundation setup" above — an Org Admin should be able to invite
   someone by email from the app itself, not the Supabase dashboard.

The GDC reference-case tab (`components/GdcChain.tsx` + `GdcTable.tsx`)
stays as-is for now — it's a worked example, not something that needs
multi-tenancy.
