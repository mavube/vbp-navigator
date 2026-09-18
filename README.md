# VBP Navigator OS — Phase 15: Commercial Documents corrections ("case 1")

Two corrections to the Phase 14 Commercial Documents delivery, from Diallo's review of it — no new area started, this closes out the open items on Area 1 before Customer Workspace begins.

## What changed

**1. Proposal can no longer convert directly into a Quotation or an Invoice.** Only Quotation → Invoice still uses the generic "Convert to…" selector. A Proposal's path to an Invoice is new and separate:

- **Mark accepted** — a manual staff action on an approved (or further-along) Proposal, recording that the customer said yes (by phone, email, or a signed copy — there's no public accept-link page yet). Sets a real `accepted_at`/`accepted_by_name`, distinct from the existing `approved` status (that's internal sign-off; this is the customer's own acceptance).
- **Create Invoice from Proposal** — appears once a Proposal is marked accepted. Creates a new, linked Invoice inheriting the recipient/anchor/currency, but with **blank line items** — a Proposal's content is prose and clarifications, not a priced breakdown, so it doesn't auto-populate a line-item table. Staff select the actual billable items from the new Price Catalog (below).

Enforced server-side, not just hidden in the UI: `POST /api/commercial-documents` now rejects any `parentDocumentId` conversion except `quotation → invoice`, and the new `fromAcceptedProposalId` path refuses to run until that Proposal's `accepted_at` is set.

**2. Line items are now select-from-a-catalog, not free-typed.** New: **Price Catalog** (`/settings/price-catalog`, Org Admin only) — a predefined list of billable items, each with a tax-exclusive unit price and an optional per-item tax rate override (blank = use the org's current VAT rate, resolved and snapshotted the moment it's added to a document). Deliberately a **new, standalone table** (`price_catalog_items`), not the existing Service & Value Architecture `services` table — a billable line item (a workshop seat, a follow-up session) often isn't 1:1 with one of the 10 named CVS/Enabling Services, and pricing doesn't belong on a table that's about methodology, not money.

In the Commercial Docs line-item editor, "+ Add line item" is now a select (catalog item, or an explicit "Custom item" option for the genuine one-off case) rather than three blank text boxes. A catalog-sourced row is read-only (its price/tax were snapshotted at selection time — editing the catalog later never retroactively changes a document that already exists); a custom row stays fully editable, same as before.

Tax is computed **per line item, after** quantity × unit price — not once on the whole document total. Every total display (the document card, the PDF, the public e-invoice page) was updated to sum per-item tax rather than applying the org's VAT rate once on the subtotal. A document with no line items at all (a flat headline amount) still falls back to the org VAT rate applied once, since there's nothing itemized to carry a per-item rate — same behavior Phase 14 always had for that case.

**Also fixed while touching this code**: the DPO payment amount created at `issue` time was using the tax-exclusive subtotal, not the tax-inclusive total shown to the customer on the PDF/e-invoice page — a real under-charge bug from Phase 14 that per-item tax made impossible to overlook. DPO now charges the same total the customer sees.

**Also wired**: the sidebar brand now renders `public/ValueBlueprint-logo.png` if present, falling back to the plain "VBP Navigator" text if it's missing — same graceful-fallback pattern the PDF's GDC logo already used. `public/gdc-logo.png` (PDF header) was already supported by Phase 14's code; no change needed there, just drop the file in.

## Apply

1. **Run the migration**: `supabase/migrations/0021_phase15_commercial_corrections.sql` — adds `documents.accepted_at`/`accepted_by_name` and creates `price_catalog_items` (RLS-enabled, same org-wide-read/admin-write shape as `org_settings`).
2. Copy the other files in this package into the matching paths, overwriting what's there. No new npm dependencies, no new environment variables.
3. Drop the two logo files at `public/gdc-logo.png` and `public/ValueBlueprint-logo.png` in the repo (you mentioned you have both) — both are picked up automatically, no further code change.
4. `npm run build` to confirm, then deploy.
5. Open **Price Catalog** (new nav link, under the same section as Company Settings) and add GDC's real billable items and prices before staff start building documents with it — it starts empty.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **29 new assertions** for this phase: catalog item create/list/edit/deactivate; invoice created with catalog-sourced line items (correct tax-exclusive amount, per-item tax rates retained); Proposal → Quotation and Proposal → Invoice conversion both rejected (400); `fromAcceptedProposalId` refused before the Proposal is marked accepted; `mark_accepted` sets `acceptedAt`/`acceptedByName`, is rejected on a second attempt, and is rejected on a non-Proposal doc type; once accepted, invoice-from-proposal succeeds with **blank** line items and inherits the recipient/parent link; Quotation → Invoice conversion still works and still inherits catalog-sourced line items; same-type conversion still rejected; a legacy free-text line item (no `catalogItemId`) still round-trips correctly.
- **Zero regressions**: the full Phase 14 suite (48 assertions) and Phase 13 suite (23 assertions) re-run against this build, all still passing.
- Playwright screenshots at 1440px and 390px of `/commercial` (catalog-select line-item picker, the Proposal card's "Mark accepted"/"Create Invoice from Proposal" buttons and green "Accepted" note, the Quotation card's "Convert to Invoice" selector with no equivalent on Proposal) and `/settings/price-catalog` (add form, item list with active/deactivate) — no horizontal overflow, correct conditional buttons per document type and status.
- Every file in this package diffed byte-for-byte against the source tree before zipping.

## Not done yet / carried forward

- The customer-facing "accept this proposal yourself" public link (an alternative to the staff "Mark accepted" attestation) — noted as a possible later enhancement, not built here; the staff-attestation path matches how Diallo described most real orders actually arriving (phone, email, a signed copy).
- Everything already carried forward from Phase 14 (GDC logo — now addressed above; DPO sandbox-vs-live decision; Mailtrap delivery webhook; DPO token refresh; Turnstile wiring; bank-reconciliation feed) is unchanged.
- **Customer Workspace is next** — confirmed as the next area, not started in this package.
