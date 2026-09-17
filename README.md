# VBP Navigator OS — v3.0 roadmap, Phase 10 "Cluster C: Business-grade forms"

This package closes the five items the v3.0 enhancement backlog called out under
"Business-grade forms" — the cluster the backlog itself described as needing
the most schema/scope growth: two entities (Customers, a Class roster) that
had no create path at all, plus real depth added to three that already
existed (Invoices, Prospects, Documents).

## What's in this zip

30 files: 1 new migration, 6 changed/new `lib/` modules, 8 API route files
(3 brand new), and 15 changed/new components. Every file replaces the file at
the same path in your project; new paths are new files.

```
supabase/migrations/0017_phase10_business_forms.sql   (new)
lib/db-invoices.ts
lib/db-customers.ts
lib/db-leads.ts
lib/db-prospects.ts
lib/db-enrollments.ts                                  (new)
lib/db-documents.ts
app/api/invoices/route.ts
app/api/customers/route.ts
app/api/customers/[id]/route.ts                         (new)
app/api/prospects/route.ts
app/api/prospects/[id]/promote/route.ts
app/api/classes/[id]/enrollments/route.ts                (new)
app/api/classes/[id]/enrollments/[enrollmentId]/route.ts (new)
app/api/documents/route.ts
components/budget/types.ts
components/budget/InvoicesSection.tsx
components/customers/types.ts
components/customers/NewCustomerForm.tsx                 (new)
components/customers/CustomerItem.tsx                    (new)
components/customers/CustomersWorkspace.tsx
components/prospects/types.ts
components/prospects/NewProspectForm.tsx                 (new)
components/prospects/ProspectsWorkspace.tsx
components/prospects/ProspectItem.tsx
components/classes/types.ts
components/classes/ClassItem.tsx
components/documents/types.ts
components/documents/NewDocumentForm.tsx
components/documents/DocumentItem.tsx
```

## Required: run the migration first

`supabase/migrations/0017_phase10_business_forms.sql` makes five changes:

1. `invoices.line_items` — a JSONB array, default `'[]'`.
2. Customers — no schema change; create/edit reuse the existing table and its
   existing partial-unique email index.
3. `prospects` — widens the `source` check constraint to allow `'manual'`
   alongside the existing `'apply'`/`'assessment'`.
4. `class_enrollments` — a brand-new table (id, class_id, customer_id,
   status, timestamps), unique on `(class_id, customer_id)`, with RLS
   policies gated the same way every other class write is.
5. `documents.attachment_url` — a plain text column, default `''`.

Run it against your Supabase Postgres database before deploying this code.
Local SQLite (`dev.db`) doesn't need a manual step — every affected
`lib/db-*.ts` module adds its column(s) defensively (`PRAGMA table_info` +
`ALTER TABLE ... ADD COLUMN`) on next server start, same pattern every prior
phase has used, and `lib/db-enrollments.ts` creates its own table the first
time it's touched, same as every other module.

## The five items

**1. Invoices: multi-line items + a class/lead linkage picker.**
The API has accepted `classId`/`leadId` since Phase 5 — the form just never
exposed them. Now, for an outgoing invoice, two optional dropdowns (scoped to
the chosen service) let you link the invoice to a real Class or Lead.
Separately, "Break this down into line items…" reveals a description/qty/
unit-amount row builder; `POST /api/invoices` computes the total as the sum
of `quantity × unitAmount` server-side whenever line items are given —
a client-sent flat `amount` alongside them is ignored, never trusted, so the
two can never silently disagree. A flat amount with no line items still
works exactly as before this phase; nothing about existing invoices changes.

**2. Customers: a real create/edit path.**
Previously the file header said this bluntly: "there's no direct
create-a-customer form... Customer [is] the entity a Lead graduates into, not
a separate intake." That framing left two real gaps — no way to add a
walk-in customer who never went through Pipeline, and no way to fix a
contact detail afterward. Both are closed now: `NewCustomerForm` (open
creation, no service tie — a Customer isn't scoped to one service) and
`CustomerItem`'s inline Edit toggle (`PATCH /api/customers/[id]`). Creating
with an email that already exists returns the existing customer rather than
a duplicate — reusing `findOrCreateCustomerByEmail`, the exact function lead
admission has always used, so the two paths can never drift into two
different dedupe rules.

**3. Prospects: a staff "log an inquiry" form + a dedupe warning on promote.**
`POST /api/prospects` lets staff log someone who called or emailed in,
entering the same review queue as a public `/apply`/`/assess` submission,
tagged with a new `'manual'` source (shown as "Staff-logged"). Separately,
promoting a prospect to a lead now checks whether that email already matches
an existing Customer or Lead, and surfaces what it found as a plain warning
banner — deliberately *not* a block. This app has no merge/relate machinery,
and a real person can legitimately come back for a second engagement (a
returning customer, a lead who went cold and reapplied), so blocking would
be the wrong call more often than not; the warning lets staff decide instead
of the app guessing. Note the warning is shown once, right after promoting,
in that browser session — it isn't persisted, so it won't reappear on a
page reload (a documented scope choice, not a bug: the underlying fact,
e.g. "already a customer," is still visible by checking Customers directly).

**4. Classes: a real enrollment/roster entity.**
"Confirm enrolled candidate list" was, and still is, just a checklist line
(`STANDARD_SETUP_TASKS` in `lib/db-classes.ts`) — that's left exactly as-is,
since it's a real, separate to-do ("go confirm the list") and not the same
thing as the list itself existing in the system. The new `class_enrollments`
table is that list: each `ClassItem` card now has a Roster section — a
picker (drawn from every Customer in the org, not filtered to this service's
own engagements, since a first-time customer can be enrolled before any
engagement record exists for them on this specific service), an enrolled
list, and a Withdraw button per enrollment. Withdrawing and re-enrolling the
same customer flips the same row back to `enrolled` rather than trying (and
failing) to insert a second one — caught during smoke testing, see below.

**5. Documents: an attachment link.**
A plain URL field, not a file upload — this app has no storage backend wired
up, and a link to wherever the file already lives (Drive, SharePoint, email)
closes the actual gap without standing up new infrastructure for it, the
same "URL field, not real storage" pattern `expenses.receiptUrl` already
uses. Shown on `NewDocumentForm` and, when present, as an "Attachment" link
on `DocumentItem`. One correction worth stating: the backlog also flagged
"no visibility into approval status... invisible on the create form" as part
of this gap — on inspection that wasn't accurate. `DocumentItem` has shown
status badges (Draft/Pending approval/Approved/Rejected) since Phase 5; a
brand-new document is always `draft` by definition, so there was never
anything to show on the *create* form specifically. No code change was
needed for that half — just the correction, stated here the same way Phase
9's dependency-feature correction was.

## What was verified

- `npx tsc --noEmit` — clean.
- `npm run build` — clean; every route table entry unchanged in shape
  (no new page routes this phase, only API routes and component changes).
- A 21-assertion Node.js API-level smoke test against a freshly reset local
  SQLite database, covering all five items end-to-end, including negative
  and edge cases: a client-sent flat `amount` is overridden by a real
  line-item total; creating a customer with an existing email returns that
  customer (not a duplicate) and an edit changes only the field sent; a
  staff-logged prospect promotes with a dedupe warning when the email
  matches an existing customer, and no warning when it's genuinely new;
  double-enrolling a customer is rejected, and — the one issue the smoke
  test caught before shipping — enrolling, withdrawing, then re-enrolling
  the same customer originally failed against the unique index until
  `enrollCustomer` was changed to flip an existing withdrawn row back to
  `enrolled` instead of always inserting; and a document's `attachmentUrl`
  round-trips correctly whether set or left blank. 21/21 passed after that
  fix.
- Playwright screenshots at 1440px and 390px across Budget → Invoices (list
  with line items/class link, and the line-item builder expanded),
  Customers (create form + inline edit mode), Prospects (staff-log form +
  a promoted prospect), Classes (roster with an enrolled customer), and
  Documents (attachment field on the form + a generated document showing
  the Attachment link) — no horizontal overflow at either width
  (`body.scrollWidth` matched the viewport exactly) and every new UI
  element rendered correctly on both sizes.

## Applying this

Same process as every prior phase: copy these files over the matching paths
in your local checkout via GitHub Desktop, run the migration against
Supabase, commit, and push — Vercel auto-deploys.
