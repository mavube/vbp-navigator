# VBP Navigator OS — Phase E: Customer Workspace Rebuild

Track 2, Phase E of the "NavigatorOS Operating Model Refinement" correction — run after Diallo's "PROCEED" on the Phase D delivery. Per the portfolio-correction assessment doc, this is "the largest single piece of new work in the brief," and it's deliberately sequenced last of the four data-model phases (B/C/D done first) because it can only tell a coherent customer story once the thing it displays — Engagement → real Product/Service — is correct.

## What changed

**The real build: `/customers/[id]`, a per-customer detail page that did not exist before this phase.** `components/customers/CustomersWorkspace.tsx` used to say so directly in its own comment ("no per-customer detail page/route to deep-link to yet"). Opening a customer from the flat list now takes you to their actual workspace instead of just scrolling to their card.

Per §9 of the brief, the page assembles, for one customer:

- **Identity** — name, email, phone, organization, editable in place (same pattern as the existing flat-list edit, just moved to its own page).
- **Every Engagement** — now correctly showing the actual GDC product/service sold (Phase C's `product_service_id`, Phase D's generic `won` stage), its status, who owns it (the service's provider), when it started, and its outcome. **Engagement status can now actually be changed** — `lib/db-engagements.ts`'s `updateEngagementStatus` has existed since Phase 4 but no API route ever called it, so every engagement in this app has been frozen at `active` since the moment it was created, until now (`PATCH /api/engagements/:id`, new in this phase).
- **Open commitments** — documents (of any type) this customer or GDC is still waiting on: not yet accepted, paid, or resolved. Computed from real status/payment-status fields already on the `documents` table, not a new concept.
- **Commercial picture** — every proposal/quotation/invoice for this customer, plus a real invoiced/paid/outstanding summary.
- **Classes** — every class this customer is (or was) enrolled in, via `class_enrollments` (a new reverse lookup, `listEnrollmentsByCustomer`, since the table only ever supported "who's in this class," not "which classes is this person in").
- **Letters & correspondence** — the five plain letter types, when actually anchored to this customer.
- **Next-opportunity suggestions** — active Products & Services Catalog items this customer has no Engagement for yet, framed honestly as a starting point for a conversation, not a recommendation engine.
- **Notes** — a comment thread (the existing generic `CommentThread` component, `entityType="customer"`) for staff communication about this customer specifically.

**Honesty note, worth being explicit about**: the brief's own wording for this section also mentions "requests" and "tasks" as customer activity. Neither `service_requests` nor `tasks` has ever had a `customer_id` — both tables are scoped to an internal Service (who's doing the work), not to the external person receiving it. Checked `lib/db-service-requests.ts` and `lib/db-tasks.ts` before writing this page. Rather than fabricate a link the schema doesn't have, this page shows only what's actually real — the same "correct the audit's wording against what the schema actually supports" call this project made for Classes' fill-rate back in Phase 8.5. If GDC wants customer-linked requests/tasks, that's a real schema change for a future phase, not something to paper over here.

## Where it shows up

- **Customers** (`/customers`) — each card now has an **Open** link (and the name itself links too) straight to that customer's workspace. The old `?highlight=<id>` scroll-to-card hack — the only way Pipeline could point at a specific customer before this phase existed — is removed; **Pipeline's "Customer record created" link now goes straight to `/customers/:id`** when the id is known from that session, falling back to the plain Customers list (which now has a real place to land) otherwise.
- **Pipeline** (`/pipeline`) — the post-win link text and target updated to match.

## Apply

1. No migration — every table this phase reads from already exists (Phase 4's `engagements`, Phase 10's `class_enrollments`, Phase 14's `documents`). This phase is pure application code.
2. Copy the 12 files into the matching paths, overwriting what's there (5 new, 7 modified).
3. `npm run build` to confirm, then deploy.
4. Nothing further required to go live.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **17 new assertions**, run against a freshly reset local database: `GET /api/customers/:id` (new) for both a real and a nonexistent customer; winning a lead into a real customer + engagement; `PATCH /api/engagements/:id` (new) advancing status through paused → completed with an outcome note, rejecting an invalid status, and 404ing on a nonexistent engagement; the change round-tripping through the existing `/api/customers` list; enrolling a customer in a class and reading it back via `GET /api/customers/:id/enrollments` (new); a commercial document (invoice) correctly anchored to the customer; and all three page routes (`/customers/:id` for a real customer, for an unknown id, and the untouched `/customers` list) returning 200.
- **Zero regressions**: Phase 15 (29), Phase 16 (22), Phase C (20), and Phase D (13) suites all re-run clean, each on its own independently freshly reset database. Full page-route sweep, all 19 routes still 200.
- Playwright screenshots at 1440px and 390px: the Customers list with its new Open link, a populated customer workspace (one engagement marked completed with an outcome note, one open commitment, a commercial summary, a class enrollment), and the not-found state for an unknown customer id. No horizontal overflow at mobile width.
- Every file in this package diffed byte-for-byte against the source tree before packaging.

## Not done yet / carried forward

- **Phase F (document engine + public entry point generalization)** is next — the `PRE_ADMISSION_TYPES`/`POST_ADMISSION_TYPES` split and `admission_communication` document type still read as PMP's own admission process rather than a neutral anchor rule, and `/apply`/`/assess` still need to ask which GDC offering someone's interested in from the catalog rather than assuming PMP (Phase C's public-products picker on the Apply form already does part of this — Phase F is the document-engine half).
- Phase G (the brief's own four validation scenarios: PMP, MS Project Training, ValueBlueprint Advisory, existing-customer expansion, run end-to-end as smoke tests) is unstarted, gated behind Phase F and a second real catalog offering actually existing.
- Track 1 (DPO payment verification) remains independent and is Diallo's to run whenever convenient.
- No bulk tool to backfill `product_service_id` on pre-Phase-C rows — unchanged, still carried forward from Phase C.
- The Customer Workspace's "next opportunity" suggestions are a simple "hasn't bought this yet" filter, not a real recommendation engine — worth revisiting if GDC wants something smarter once there's real cross-sell history to learn from.
