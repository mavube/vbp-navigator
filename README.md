# VBP Navigator OS — Production Readiness, Area 1: Company Settings + Commercial Documents (Proposals/Quotations/Invoices) with real DPO payment and Mailtrap email

This is the first BUILD→VALIDATE area of the "Truth Mode" production-readiness directive. It replaces the old money-less Proposal/Quotation letter templates with real, chainable, money-bearing commercial documents, adds a real Company Settings screen so legal/banking details aren't hardcoded, and wires genuine DPO payment and Mailtrap email — no mock data, no simulated sending, anywhere in this package.

## What this ships

**Company Settings** (`/settings/company`, Org Admin only) — legal name, registration number, TIN, address, bank details, VAT status/rate, default currency, payment terms text, the Mailtrap sending identity, and the Turnstile site key. Everything a generated invoice needs that used to have nowhere real to live.

**Commercial Documents** (`/commercial`) — Proposal, Quotation, and Invoice, upgraded from the old plain-letter versions into real money-bearing documents:

- **Flexible entry points.** Diallo's requirement: "not every transaction starts with a proposal... some start directly with an invoice." Each of the three types can be created standalone — anchored to a Lead, an Engagement, an existing Customer, or *nothing at all* (the phone/email-order case: service + recipient name/email, typed by hand) — or **converted** from one that's already approved, inheriting its recipient, line items, amount, and currency instead of re-typing them.
- **Real 8-state lifecycle:** Draft → Under Review → Approved → Issued → Sent → Delivered → Acknowledged (plus Rejected). Approve/Reject uses the same Budget Approver authority as a Budget Request — a commercial document is a real financial commitment now. `delivered` and `acknowledged` are real columns and real states, but nothing in this build sets them automatically for Proposal/Quotation — that needs a Mailtrap delivery webhook this area doesn't build (see "Not done yet"). For Invoice, `acknowledged` **is** wired: it is set only by a confirmed DPO payment, never by a staff click — see below.
- **Real line items**, amount computed from them (never trusted from the client when items are given), currency, due date.
- **Real PDF** (`lib/pdf-commercial.ts`, via `pdf-lib`) — org legal header, recipient, line items, VAT-aware totals, bank-transfer fallback, and — for an issued invoice with DPO configured — a clickable "Pay Now" link plus the plain URL as a fallback. No GDC logo embedded yet; see "Needs from you."
- **Real DPO payment** (`lib/dpo.ts`) — `createToken` at issue time, `verifyToken` on the customer's return — the *only* thing this app trusts to mark an invoice paid, never the browser redirect alone. See "Important — read before testing" below.
- **Real Mailtrap email** (`lib/mailtrap.ts`) — sends the PDF as an attachment plus the e-invoice link, via Mailtrap's Sending API (not their Testing sandbox). Every attempt, success or failure, is logged to a new `email_log` table — a failed send leaves the document at `issued`, never falsely marked `sent`.
- **E-invoice hosted page** (`/invoice/[token]`, public, unauthenticated, reachable only via the opaque access token issued at issue time) — shows the document, and for an invoice, a "Pay Now" button or bank details. `/invoice/[token]/return` is where DPO redirects the customer back to; it calls `verifyToken` server-side and only then records payment.

## Important — read before testing

The DPO credentials on file are **production, not sandbox** (confirmed by Diallo, 2026-09-17). Because of that, **this build never once called DPO's live API** — the XML request-building and response-parsing were verified against DPO's own documented fixture response shapes (20 fixture-based checks, no network call — see "Verified before packaging"), not a live round trip. The first real call this code makes will move real money. Before it goes anywhere near a real customer:

1. Ask DPO whether a parallel sandbox/test merchant account can be issued alongside the production one — most gateways offer this, and it's the cleanest way to test safely.
2. If not, the first live test should be one small, real, deliberately-watched transaction (e.g. TZS 1,000) that you and I confirm end-to-end together — not something run unattended.

## Apply

1. **Run the migration first**: `supabase/migrations/0020_phase14_commercial_documents.sql` — widens `documents`' doc_type/status vocabularies, adds the commercial-document columns (amount, line_items, payment_status, DPO fields, access_token, etc.), and creates two new tables: `org_settings` and `email_log`, both RLS-enabled.
2. **Set the new environment variables** in Vercel (see the updated `.env.example` in this package for the full list and comments) — `DPO_COMPANY_TOKEN`, `DPO_SERVICE_TYPE`, `DPO_PAYMENT_URL` (the exact URL DPO gave you), and `MAILTRAP_API_TOKEN`. None of these go in Company Settings' UI — that's by design (see `.env.example`'s comments on why).
3. Copy the other files in this package into the matching paths in the repo, overwriting what's there.
4. `npm install` — this phase adds one new dependency, `pdf-lib` (pure JS, no native binary, serverless-friendly — already reflected in the included `package.json`/`package-lock.json`).
5. `npm run build` to confirm, then deploy as usual.
6. Open Company Settings and fill in GDC's real legal/banking/VAT details, the Mailtrap sending address, and the Turnstile site key.

## Needs from you

- **The GDC logo file.** Drop it at `public/gdc-logo.png` (or `.jpg`/`.jpeg`) in the repo and it's picked up automatically on the next deploy — no further code change needed (`lib/pdf-commercial.ts` and the two API routes that call it already look for it by that exact filename). Until then, PDFs render with the legal name as text instead of the mark — still a real, correctly-branded document, just without the logo.
- **Confirm the DPO sandbox-vs-live testing approach** above before the first real invoice goes out to a real customer.
- **Legal invoice footer details** (registration number, TIN, address, bank details, VAT rate) — fill these into Company Settings once deployed; nothing is pre-filled.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **48-assertion Node.js smoke test** against a freshly reset local SQLite database, run twice (once in dev, once against the actual `npm run build` production output): Company Settings GET/PATCH/persistence; standalone invoice creation from no anchor at all (the phone-order case) and its rejection when service/recipient are missing; the full lifecycle draft→under_review→approved→issued (document number + access token assigned, DPO warning surfaced cleanly since DPO isn't configured in this environment); send correctly refused with a clean 503 when Mailtrap isn't configured, and the document status confirmed to **stay at `issued`, never silently advance to `sent`**, on that failure; real PDF bytes returned (`%PDF-` header) from the staff PDF route; the public e-invoice page rendering real content and 404ing on a bogus token; document conversion (quotation → invoice) refused while still a draft, succeeding once approved, and correctly inheriting amount/recipient/parent link; an invoice refusing a manual "mark acknowledged" (payment-driven only, never a staff override); the old `/api/documents` route refusing `proposal`/`quotation` (moved to Commercial Docs) while still creating its five original letter types; and a full regression sweep of every other page and the Phase 13 Organizational Memory suite (23/23, unaffected).
- **20-assertion fixture test for the DPO client** (`lib/dpo.ts`) — the XML request builder and response parser checked against DPO's own documented example response bodies (createToken success/failure, verifyToken paid/pending/declined), plus a monkeypatched-`fetch` check that `createDpoToken` posts well-formed, correctly-escaped XML to the configured endpoint and correctly builds the payment URL from the response. Zero network calls to DPO's real API at any point.
- Playwright screenshots at 1440px and 390px of `/commercial`, `/settings/company`, and a live `/invoice/[token]` e-invoice page (an unpaid TZS 295,000 invoice with 18% VAT correctly computed) — no horizontal overflow, correct lifecycle-action buttons per status, dark-mode tokens inherited automatically.
- Every file in this package diffed byte-for-byte against the source tree before zipping.

## Not done yet / carried forward

- **`delivered`/`acknowledged` aren't reachable for Proposal/Quotation** without a Mailtrap delivery-webhook integration — not built in this area. `acknowledged` is fully wired for Invoice (payment-driven), by design.
- **Document numbers aren't globally sequential** (`INV-202609-XXXXXX`, random suffix, not a counter) — fine for now, worth revisiting if GDC needs strict sequential numbering for tax/audit purposes.
- **No DPO token refresh/expiry handling** — a DPO transaction token is created once at issue time and reused for the life of that invoice's payment window; if DPO expires it before payment, the fix today is re-issuing, not automatic retry.
- **GDC logo not embedded yet** — see "Needs from you" above.
- **Turnstile isn't wired into any form yet** — the site key has a home in Company Settings, but public-form hardening (the `/start` consolidation, CAPTCHA, rate limiting) is a later area of the production-readiness build, not this one.
- **Bank-transfer-only invoices still need a human to mark them paid** — there's no bank-reconciliation feed in this build; only a DPO-verified payment is recorded automatically.
- The rest of the "Truth Mode" directive (Customer Workspace, Engagement Outcome capture, Batch/Class operational workspaces, Operational Support, per-provider workspaces, Dashboard redesign, the system-wide UI/UX pass, security audit, `/start` consolidation) is unstarted — this is Area 1 of many.
