# VBP Navigator OS

A standalone, self-hosted Next.js app built on the ValueBlueprint® method.
**v1.0** (Sept 2026) shipped the Service & Value Architecture map of VBP's
own operation, plus the GDC PMP Master Class reference case. **v2.0** is in
progress: a full service-management platform (multi-tenant SaaS + internal
tool) — see `claude/vbp-navigator-os-v2-alignment.md` and
`claude/vbp-navigator-os-v2-build-guide.md` in the project for the full
plan. This README documents both — sections below say which version they
describe.

## v2.0 status: Foundation + Phase 2 (Tasks)

Foundation (multi-tenant data model, Supabase Auth, design system core,
PWA shell) is in — see **"v2.0 Foundation setup"** below. **Phase 2
(Processes/Tasks)** is also in — a `/tasks` page, backed by a real
`tasks` table, is the first working feature module; see **"Phase 2: Tasks"**
below. Remaining modules (Pipeline, Classes, Budget, ...) come next, each
additive on top of what's here. Full roadmap:
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
  api/
    findings/route.ts          — GET all findings for the caller's org (auto-seeds)
    findings/[id]/route.ts      — PATCH one finding's status/note, scoped to org
    services/route.ts            — GET the caller's org's service catalog
    tasks/route.ts                 — GET (list, optional ?serviceId=) / POST (create) tasks
    tasks/[id]/route.ts              — PATCH a task's status (Service Owner/Contributor/Org Admin only)
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
lib/
  db-driver.ts       — shared Postgres/SQLite connection setup + the RLS-vs-app-filtering note (read this first)
  db.ts                — findings data layer, now org-scoped
  db-services.ts         — read access to the services table (+ local-dev demo seed)
  db-tasks.ts               — the tasks table's data layer
  permissions.ts               — app-level role checks (mirrors the RLS policies for the DATABASE_URL code path)
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
