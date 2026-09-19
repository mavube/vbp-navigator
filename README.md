# Invoice Reconciliation — Design/Migration Pass

Sits between Phase 1 (intake backbone) and Phase 2 (PMP eligibility) in the `/start` Warm Lead Intelligence build order, per the decisions recorded in `vbp-navigator-os-start-warm-lead-intelligence-plan.md`. This was decided, not part of the six numbered phases — a prerequisite for Phase 5's invoice-paid trigger, which needs a single trustworthy source of truth for revenue before it can fire on it.

## The problem

Two disconnected tables both called themselves "invoices":

- **`documents`** (Commercial Documents) — the customer-facing proposal → quotation → invoice chain Sales actually uses. Tied to `customerId`/`engagementId`/`leadId`/`serviceId`, carries a real `currency` field, `amount`, and `paymentStatus`. This is what `CustomerDetail.tsx` reads for a customer's billing history.
- **`invoices`** (Budget module) — a staff-facing manual entry table with `direction: "incoming"|"outgoing"`. No `customerId`, no `currency` field at all. `lib/rollups.ts` summed this table's `outgoing` rows into the org-wide `revenueOutgoingTotal`/`revenueCollectedTotal` — meaning the Dashboard's revenue numbers never reflected what Sales was actually invoicing through Commercial Documents.

A customer invoice created through the real sales chain and one typed into Budget as a manual "outgoing" row looked the same to a user but were invisible to each other.

## The fix

`documents`' invoice rows (`doc_type = 'invoice'`) are now the one source of truth for revenue owed to and collected by VBP. The `invoices` table narrows to incoming (vendor bills) only, which was always its more clearly-scoped role.

### `lib/rollups.ts`

Both revenue queries — the per-service one inside `getServiceRollups()` and the org-wide one inside `getFiscalYearSummary()` — now read `documents WHERE doc_type = 'invoice' AND amount IS NOT NULL` instead of `invoices WHERE direction = 'outgoing'`. `revenueCollectedTotal` now narrows on `payment_status = 'paid'` (documents' column) instead of `status = 'paid'` (invoices' column) — same meaning, different table. `ensureAllSchemas()` now forces `documents` into existence via `ensureDocumentsSchema()` instead of `ensureInvoicesSchema()`, so a fresh SQLite dev database doesn't need a prior Commercial Documents write before rollups can query it.

Known limitation, carried over rather than introduced by this change: amounts are summed as plain numbers regardless of each document's `currency` field, so this is only correct for an org invoicing in a single currency. Fixing that is unscoped here — flagging it plainly rather than silently inheriting it.

### `components/budget/InvoicesSection.tsx`

The direction picker is gone — this form only creates incoming (vendor bill) rows now. The class/lead linkage picker (only ever meaningful for an outgoing invoice) is gone with it. The party field's placeholder is always "Vendor". Historical outgoing rows, if any exist from before this change, still display in the list below with their original `· outgoing` label and any linked class/lead — nothing here deletes existing data.

### `app/api/invoices/route.ts`

POST now rejects `direction: "outgoing"` with a 400 and a message pointing to Commercial Documents, closing the gap at the API level rather than only in the one UI that used to expose it.

### `lib/db-invoices.ts`

Header comment rewritten to describe the narrowed, incoming-only scope going forward, and to explain why `InvoiceDirection` still includes `"outgoing"` as a type (so historical rows keep reading correctly) even though nothing should create a new one.

### `app/budget/page.tsx`

The Budget page's own description said "both incoming (vendor bills) and outgoing (billing customers)" — now stale. Updated to say billing customers happens in Commercial Documents.

## Not a schema change

No migration. The `invoices` table isn't dropped or altered — it keeps existing rows (including any historical `outgoing` ones) exactly as they are; it simply stops being written to with `direction: "outgoing"` and stops being read for revenue.

## One known, accepted side effect

`lib/db-org-memory.ts` stores daily snapshots of `revenueOutgoingTotal`/`revenueCollectedTotal` for historical trend computation (read by `lib/ai-context.ts`, narrated by `app/api/ai/observe/route.ts`). Switching the revenue source will cause a one-time discontinuity in that trend the day this ships — acceptable given Truth Mode (production currently has no revenue data in either table), but worth stating honestly rather than leaving implicit.

## Apply

Copy all five files into their matching paths. No migration, no env var changes, no other files touched.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **11 assertions** against a freshly reset local database:
  - Two invoice documents created directly on `documents` (500,000 + 300,000), one proposal document (999,999, deliberately excluded from revenue).
  - One invoice marked paid via `recordPayment`.
  - `getServiceRollups()` returns `revenueOutgoingTotal: 800000`, `revenueCollectedTotal: 500000` for the service — proposal correctly excluded.
  - `getFiscalYearSummary()` returns the same totals for the current fiscal year.
  - `/api/rollups` (the real HTTP route, not just the function) returns matching numbers.
  - `POST /api/invoices` with `direction: "outgoing"` now returns 400 with an error message pointing to Commercial Documents.
  - `POST /api/invoices` with `direction: "incoming"` still succeeds (201).
  - The new incoming invoice does **not** move `revenueOutgoingTotal` — confirming the old table is now fully disconnected from revenue reporting.
- Playwright screenshot of the Budget → Invoices tab: no direction dropdown, no linkage picker, "Vendor" placeholder, and the historical incoming invoice from the test script displaying correctly with its `· incoming` label.
- Playwright screenshot of the Dashboard: "Revenue invoiced 800,000", "Revenue collected 500,000", "Net 500,000" — all sourced from Commercial Documents, confirming the Budget-table incoming invoice created in the same test run had no effect on these numbers.
- Full route regression sweep across 18 routes (core app pages, `/start/vbp`, and the `/apply/vbp`/`/assess/vbp` redirect stubs) — all `200` except the two redirect stubs at their expected `307`.

## Not done yet / carried forward

Still ahead, in order, per the plan doc:
- Phase 2 — PMP eligibility, facts only (the four real PMI pathways checked against PMI's actual requirements, no score).
- Phase 3 — Conversation Brief + a real Task created on promotion, on the Lead page.
- Phase 4 — existing-customer detection moved from promotion-time to `/start` submission-time.
- Phase 5 — the post-conversion opportunity engine (Engagement-completed, invoice-paid, class-completed, and organization-level grouping triggers) — now unblocked by this pass, since it needs exactly this single source of truth for the invoice-paid trigger.
- Phase 6 — card-based visual pass across the Customer/Lead pages, and the "Room to grow with [Name]" copy rewrite on the Customer page's suggestions section.
