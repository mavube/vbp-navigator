# VBP Navigator OS — v3.0 Roadmap: Value Creation Operating System

Drafted 2026-09-16, in response to Diallo's "Master Revamp / Enhancement Brief — Truth Mode." This is the working plan for turning the brief's 30 sections into buildable, sequenced, validated phases — following the brief's own discipline (§27-29: understand before changing, validate before advancing, no stacking unvalidated work). Nothing here starts building until phase order is confirmed.

## How this relates to what's already live

v2.0 is deployed and working (Vercel + Supabase, confirmed 2026-09-16): Services (9-field CVS/Enabling model with `depends_on`/`feeds`), Tasks, Pipeline/Leads, Classes, Budget (requests/expenses/quotations/invoices), Compensation Earning Service (real payroll), Service Requests, Collaboration/comments, Capabilities/Workload views, org-level multi-tenancy via Supabase RLS. All of it is internal-only, behind Supabase Auth, for VBP's 5 staff.

The v3.0 brief is not a rewrite of this. Most of it either extends what's live or adds genuinely new subsystems alongside it. Per §27, nothing here proposes tearing out working v2.0 functionality.

## Decisions confirmed (2026-09-16)

- **Financial year = calendar year** (Jan–Dec). This means GDC's FY does not follow the July–June Tanzania government convention the brief's "FY 2025/26" example implies — FY will be labeled as a single year (e.g. "FY2026"), not a split year. Simpler to implement than the brief's example suggested.
- **Public customer entry point** (§6) lives in the same Next.js app as new unauthenticated public routes (e.g. `/apply`, `/assess`), writing into the same database as a new prospect entity that converts into a full customer record on admission. One codebase, one deploy — matches the brief's own "one operating environment" principle.
- **AI Operating Layer** (§19) gets built with real Claude API access, strictly org-scoped (RLS-enforced — AI never sees across tenants), starting with Observe/Understand/Advise before Forecast/Assist. Requires Diallo to provision an Anthropic API key as a Vercel environment variable when that phase starts.
- **UI/UX redesign** (§22-26) happens as its own focused design-system phase first — shared tokens and components applied to every existing screen immediately, then to every new screen after. Not a progressive per-phase restyle.

## Section-by-section status

| § | Topic | Status | Note |
|---|---|---|---|
| 1-3 | Core truth, operating chain, service ecosystem | Conceptually live | Services table already models CVS/Enabling; chain concepts (Customer→Situation→Service→Engagement→Outcome) don't exist as distinct entities yet — Customer and Engagement barely exist today (Leads is the closest analog) |
| 4 | Service Catalogue | Partial | Services table has 9 fields; catalogue needs ~10 more (customer need, target customer, delivery model, commercial model, related/preceding/succeeding services) |
| 5 | Service Graph / Next-Value Engine | Partial | `depends_on`/`feeds` arrays already exist in schema, never rendered as a graph or used to suggest anything |
| 6 | Public customer entry point | New | No public/unauthenticated surface exists at all today |
| 7 | PMP Readiness Assessment (prospect-facing) | New | Directly closes existing Finding 1 gap ("not evidenced") in the internal service architecture doc |
| 8 | Org-sponsored journey + document generation | New | No document generation of any kind exists |
| 9 | Customer intelligence | New | No Customer entity exists distinct from Leads |
| 10 | Work + collaboration, multi-view | Partial | Tasks/Comments exist with a board view; Gantt/Calendar views don't exist |
| 11 | Blocker intelligence | Partial | Task status/dependencies exist; blockers aren't first-class objects with owner/impact/required-action |
| 12 | Internal service provider model | Live | This is exactly the existing Services + role_assignments model |
| 13 | Compensation Earning Service | Live | Already built essentially as specified — Basic Pay + Allowances − Deductions = Net Pay, Tanzania NSSF/WCF |
| 14 | Financial-year-aware model | New | No FY dimension exists anywhere in the schema today |
| 15 | Value performance (work≠output≠outcome≠value) | New | Outcome is currently a single text field on Service, not a tracked distinction |
| 16 | Service health | Partial | Capabilities/Workload view is the closest existing piece; no consolidated health view |
| 17 | Organizational memory | New | Findings tracking is the closest existing piece, but it's narrow (4 fixed findings, not general decision/lesson capture) |
| 18 | Capacity intelligence | Partial | Workload view shows current assignment load; no demand→capacity gap modeling |
| 19 | AI operating layer | New | Confirmed in earlier research: no AI integration was ever scoped anywhere in prior docs |
| 20 | Financial + operational connection | Partial | Budget/Compensation already connect to Service; connecting revenue/cost back to Outcome doesn't exist |
| 21 | Scenario / what-if | New | Explicitly deprioritized by the brief itself — build last |
| 22-26 | UI/UX premium redesign | New | Confirmed gap — v2.0 vision doc called for this design pass, every phase reused basic v1.0 styling instead |
| 27-29 | Development discipline | Process, not a build item | Applied throughout this roadmap, not its own phase |
| 30 | North star | Framing | Guides every phase below, not a deliverable itself |

## Proposed phase sequence

Each phase ends with a validation gate in the brief's own §28 format (What was built / tested / passed / failed / remains / known risks / technical debt / architecture concerns / recommended corrections) before the next phase begins. No phase starts on an unvalidated previous one.

**Phase 0 — Housekeeping (short, before anything else)**
Remove the temporary `/api/debug` diagnostic route now that the production database issue is resolved. Fix `BudgetWorkspace.tsx`'s silent error-swallowing (services fetch converts any failure into an empty array instead of surfacing it, unlike Tasks). Document the Supabase pooler/SSL/password-encoding lessons from this week's deployment in the build guide so they aren't rediscovered next time. Cheap, isolated, no design decisions needed.

**Phase 1 — Design System Foundation**
Shared tokens (color, type scale, spacing, shadow, radius) and shared components (cards, tables, nav, buttons, badges) per §22-26, applied immediately to every existing screen (Tasks, Pipeline, Classes, Budget, Compensation, Service Requests, Capabilities). This is the phase that actually answers the UI/UX complaint you raised days ago — not deferred to the end.

**Phase 2 — Service Catalogue + Service Graph**
Extend the Services table with catalogue fields (§4). Build a real graph view from the existing `depends_on`/`feeds` data (§5). Replace the static `ServiceCards.tsx` JSX with this dynamic, database-backed view — this is the direct answer to your earlier question about whether the static v1.0 Architecture page is still necessary: it becomes this.

**Phase 3 — Financial Year dimension**
Add `fiscal_year` as a queryable attribute across Services, Budget, and Compensation (§14). Since FY = calendar year, this is more straightforward than the brief's July–June example implied. Builds the "previous FY / current FY / next FY" comparison views.

**Phase 4 — Customer, Engagement & Public Entry Point**
The largest new subsystem. New Customer and Engagement entities distinct from Leads (§2-3, §9). New unauthenticated public routes for the entry point and PMP Readiness Assessment intake (§6-7), writing into a prospect table that converts to a full Customer record on admission. Org-sponsored journey groundwork (§8) — the underlying data model, not yet the document generation itself.

**Phase 5 — Document Generation Engine**
Templated document generation (proposal, quotation, invitation, approval request, confirmation, admission communication, completion record) tied to Customer/Service/Engagement, versioned, with approval state (§8 completed).

**Phase 6 — Work Views + Blocker Intelligence**
Add Gantt and Calendar views alongside the existing Kanban/List (§10). Make blockers first-class, traceable objects (§11).

**Phase 7 — Service Health, Capacity Intelligence & real KPI Dashboard**
Builds directly on Phase 2 (catalogue) and Phase 3 (FY) to show real demand/capacity/revenue/cost/outcome per service, historically and currently, with basic forward projection (§15-16, §18, §25). This is what finally answers your "no dashboard for real work KPIs" complaint — with real data behind it, not decorative cards.

**Phase 8 — AI Operating Layer**
Claude API wired in, org-scoped via RLS. Observe/Understand/Advise first (summarize situations, connect related information, suggest next actions and relevant services) — Forecast/Assist (drafting documents, demand forecasting) only once that's validated (§19). Deliberately sequenced after Phases 2-7 so there's an actual connected, reliable data model for it to reason over — this matches the brief's own framing, not an arbitrary delay.

**Phase 9 — Organizational Memory**
Decision/lesson capture (§17), feeding directly into what the AI layer built in Phase 8 can surface as historical pattern-matching.

**Phase 10 — Scenario / What-if**
Explicitly last, per the brief's own instruction not to build this prematurely (§21).

## What this means for your four original open questions

1. **Static Architecture page** — resolved by Phase 2: it stops being static JSX and becomes the dynamic Service Catalogue + Graph.
2. **No real KPI dashboard** — resolved by Phase 7, once FY and catalogue data exist to make it meaningful rather than decorative.
3. **AI integration** — was never previously planned (confirmed by earlier research); now explicitly scoped as Phase 8.
4. **UI/UX redesign** — moved to Phase 1, immediately after today's housekeeping, not deferred to the end.

## Honest scope note

This is a multi-month build, not something to compress into one or two sessions — ten phases, several of which (Phase 4 especially) are substantial new subsystems with their own data model and access-control decisions. Nothing here should be read as "let's do it all now." The next concrete step is Phase 0 (quick) followed by Phase 1 (design system), each closing with its own validation report before Phase 2 starts.
