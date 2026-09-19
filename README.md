# VBP Navigator OS — Decision-Support Signals: Customers, Commercial Docs, Products & Services

The third and last of the confirmed post-Phase-G next steps, in Diallo's own words: "the pages are predictable and boring... this is a decision-supporting system, not QuickBooks or Tally."

## What this actually is (scoping note)

The original plan for this step was "extend the Lead assessment panel's structured-facts treatment to Customer, Product, and Invoice/Quote/Proposal pages" — the same fix as the Lead panel, applied to more pages. Before starting, I went looking for the same problem (raw `Object.entries()` key/value dumps) on those pages and it isn't there: `CustomerDetail.tsx` and `CommercialDocumentItem.tsx` already render structured summaries — engagement cards, line-item tables, payment badges — not raw JSON. The one place that pattern genuinely still exists is `components/prospects/ProspectItem.tsx`, already flagged as carried-forward work in the Lead assessment fix package.

So this package does something different, confirmed with Diallo directly: rather than reformatting data that was already well-presented, it surfaces **new facts that weren't shown anywhere before** — the kind of thing a person would have to open every single document and do date math by hand to notice. Nothing here is projected, inferred, or synthesized; every number comes from a real field already in the schema (`dueDate`, `paymentStatus`, `status`, `sentAt`, `productServiceId`, a line item's `catalogItemId`).

## What changed

### New: `lib/commercial-doc-signals.ts`
Two small, pure functions, used everywhere overdue/stalled logic is needed so the definition never drifts between pages (same reasoning as `lib/assessment-questions.ts` in the Lead fix):
- **`isOverdueInvoice(doc)`** — true when an invoice's `paymentStatus` is `unpaid` or `failed` and its `dueDate` has passed.
- **`isStalledDocument(doc)`** — true when a proposal/quotation/invoice has sat in `sent` or `delivered` for at least `STALL_THRESHOLD_DAYS` (currently 14) with no reply.

**`STALL_THRESHOLD_DAYS = 14` is a judgment call, not a number derived from GDC's real response-time history** — there isn't enough production history yet to derive one honestly. Easy to change (one constant) once real data suggests a better number.

### `components/customers/CustomerDetail.tsx`
- Open Commitments and Commercial sections now badge an overdue invoice in red with its exact day count (e.g. "Overdue 12d").
- The Commercial payment-summary row gains a fourth stat — "Overdue: TZS X (N)" — only shown when something is actually overdue, so a healthy customer's page looks exactly as it did before.

### `components/commercial/CommercialDocumentItem.tsx`
- Each document card now shows an "Overdue Nd" badge (invoices only) or a "No response Nd" badge (proposals/quotations sitting sent/delivered too long), computed from the shared signals module.

### `components/commercial/CommercialDocsWorkspace.tsx`
- New "Needs attention" section at the top of the page, shown only when something qualifies — every overdue invoice and every stalled proposal/quotation in one place, so nothing requires opening each document individually to notice.

### `components/settings/PriceCatalogManager.tsx`
- Each catalog item now shows a real performance line: active/total engagement count (from `Engagement.productServiceId`) and invoiced/collected revenue by currency (summed from matching `catalogItemId` line items across real invoices, excluding drafts and rejected ones). An item with no activity says "Not sold yet" plainly rather than showing nothing. This is the direct answer to "which offerings are actually moving" — the same portfolio-correction narrative this whole project has been running since Phase B/16, now backed by real usage instead of just a price list.
- Fetches two more org-wide endpoints already used elsewhere in the app (`/api/customers` for engagements, `/api/commercial-documents`) — no new endpoint, no schema change.

## Why no migration or new API routes were needed

Every fact shown here already existed in the database and was already returned by an existing endpoint — this is entirely a client-side read-and-compute exercise against data the app already had. `dueDate`/`paymentStatus`/`status`/`sentAt` were already on `CommercialDocument`; `productServiceId` was already on `Engagement`; `catalogItemId` was already on a line item. Nothing new is written anywhere.

## Apply

1. Copy the 5 files into their matching paths, overwriting what's there (`lib/commercial-doc-signals.ts` is new; the other 4 already exist).
2. `npm run build` to confirm, then deploy.
3. Nothing else required — no migration, no data backfill, no environment variable.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **15 new assertions** against a freshly reset local database, exercising the real lead → won → customer → engagement flow (not a shortcut): a catalog item created; a lead with `productServiceId` set, promoted to "won," auto-creating a customer and an *active* engagement correctly carrying the product link; two invoices and one quotation created against that same catalog item and customer. Local dev has no Mailtrap/DPO credentials (same reason Track 1/DPO verification has always been "Diallo's to run against production" in every prior phase report), so the fields those integrations would normally set (`paymentStatus: paid`, a real `sentAt` on send) were set directly in the test database as fixture backdating — standing in for what a real payment webhook and a real send would produce, not a new production code path. On top of that: confirmed one invoice reads as paid+acknowledged, one reads as unpaid with a due date 12 days in the past, one quotation reads as sent 21 days ago (past the 14-day threshold); then independently reproduced `PriceCatalogManager`'s own stats calculation against the live API responses and confirmed it lands on the exact right numbers (1 active/1 total engagement, TZS 1,000,000 invoiced, TZS 500,000 collected). 15/15 passed.
- Playwright screenshots at 1280px confirming all three pages render correctly: the Customer page showing the red overdue badge and the "Overdue: TZS 500,000.00 (1)" stat; the Commercial Docs page's new "Needs attention" section listing both the overdue invoice and the stalled quotation, plus matching badges on each document card; the Products & Services Catalog showing "1 active engagement · Invoiced TZS 1,000,000.00 · Collected TZS 500,000.00" on the PMP Master Class item.
- Mobile screenshot (390px) of the Customer page — all new elements render correctly with no horizontal overflow.
- Full page-route regression sweep across the same 10 core routes used in every prior phase — all returned `200` after this change.
- All 5 files diffed byte-for-byte against the live source tree before packaging.

## Not done yet / carried forward

- `components/prospects/ProspectItem.tsx` still renders assessment answers as raw `Object.entries(...)` key/value pairs — the one genuine remaining instance of the pattern the Lead fix solved elsewhere. Not touched here since it wasn't part of what this pass was scoped to (new facts, not reformatting); worth a quick, small follow-up pass if Diallo wants full consistency.
- `STALL_THRESHOLD_DAYS` (14) is a starting guess, not a data-derived number — worth revisiting once GDC has enough real send-to-response history to set it properly.
- This closes out all three of Diallo's confirmed post-Phase-G next steps (Lead assessment data, catalog dropdowns, decision-support signals). The production "empty white space" sidebar-gap report remains unresolved and explicitly deferred by Diallo ("we will fix the ui later") — unchanged by this package.
- Everything already carried forward from the catalog-dropdown fix package is unchanged by this fix.
