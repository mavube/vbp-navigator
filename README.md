# VBP Navigator

A standalone, self-hosted version of VBP Navigator — the Service & Value
Architecture map of VBP's own operation (Customer Value Services vs.
Enabling Services), plus the GDC PMP Master Class reference case, built on
the ValueBlueprint® method. This is the same content and design as the
VBP Navigator Claude Artifact, rebuilt as a real Next.js app with its own
database, so it lives at your own URL instead of inside a Claude
conversation.

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
- **An optional shared passcode gate** (`proxy.ts` — Next 16's renamed
  "middleware" convention) — one password for the whole team, not real
  per-user accounts. Off by default (open access) until you set
  `APP_PASSCODE`.

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
3. In your deployment's environment variables, set:
   - `DATABASE_URL` — the `postgres://...` connection string from step 2.
   - `APP_PASSCODE` — a password only Jennifer/Edwin/Anne/Twesa/you know.
     Skip this only if the deploy URL itself is private enough (e.g. a
     Vercel preview URL nobody else has).
4. Deploy. The findings table is created automatically on first request —
   there is no migration step to run by hand.

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
  page.tsx              — renders <NavigatorApp />
  layout.tsx            — root HTML shell, loads global styles
  globals.css            — the full "blueprint" design system (ported 1:1
                            from the original artifact's inline <style>)
  login/page.tsx          — passcode entry screen
  api/
    findings/route.ts     — GET all findings (auto-seeds on first call)
    findings/[id]/route.ts — PATCH one finding's status/note
    login/route.ts        — verifies APP_PASSCODE, sets the auth cookie
components/
  NavigatorApp.tsx         — tabs, layout, all static copy for both tabs
  InternalChain.tsx         — the internal-ops service-chain SVG diagram
  GdcChain.tsx               — the GDC reference-case SVG diagram
  ServiceCards.tsx            — CVS/Enabling service cards + provider table
  GdcTable.tsx                  — GDC department→service table
  Findings.tsx                   — the interactive, polling-synced findings
lib/
  db.ts     — the SQLite/Postgres data layer described above
  findings-data.ts — the fixed title/body copy for the 4 seeded findings
proxy.ts    — the optional passcode gate (Next 16's "middleware" rename)
```

## Extending this

This app deliberately does **not** grow into a task manager, ERP, HR
system, or ticketing tool — that scope boundary carried over from the
original VBP Navigator design brief. The two things worth adding next, in
likely order of value:

1. **A second reference case** — GDC's other Customer Value Services
   (Business Transformation & ICT Systems Advisory, Project Management &
   Implementation Advisory, Business Process & Value Advisory) or an
   entirely different client, as a third tab. The pattern in
   `components/GdcChain.tsx` + `GdcTable.tsx` is the template to copy.
2. **Editable services**, not just editable findings — right now the
   service definitions (the 9-field cards) are static JSX; moving them
   into the database the same way findings work would let the team update
   owners/backups/dependencies without a code change. `lib/db.ts` and the
   findings API routes are the pattern to extend.

Both are additive — nothing above needs to change to support them.
