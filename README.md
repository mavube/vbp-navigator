# Phase 8.5 — Quick Wins (post-Phase-8 enhancement backlog, Cluster A)

Follows the live-usage feedback after Phase 8 (AI Operating Layer): a real bug report (Gantt/Calendar "Invalid Date") plus a five-part enhancement request, which was audited and written up in the project's new `vbp-navigator-os-v3-enhancement-backlog.md` doc. You chose "Workflow wiring" as the next full phase and asked for this quick-wins bundle first, the same way Phase 0 (Housekeeping) worked before Phase 1.

## Bug fix (may already be applied)

If you already applied the standalone `db-driver.ts` sent earlier in this conversation (the fix for Gantt/Calendar showing "Invalid Date"), you're already up to date on this one — it's included again here only so this package is self-contained. If you haven't applied it yet, this is that same fix: Postgres `date` columns now return as plain "YYYY-MM-DD" strings instead of full ISO timestamps, matching what SQLite (dev) always returned.

## How to apply

Everything else here is either a new file or a clean drop-in replacement — no merging needed, this reflects the current state of each file:

**New:**
- `components/ui/ThemeToggle.tsx`
- `supabase/migrations/0015_phase85_quick_wins.sql`

**Replace:**
- `lib/db-driver.ts` (see above)
- `components/pipeline/NewLeadForm.tsx`, `components/pipeline/LeadItem.tsx`
- `components/customers/CustomersWorkspace.tsx`, `app/customers/page.tsx`
- `components/budget/ExpensesSection.tsx`, `components/budget/InvoicesSection.tsx`, `components/budget/NewBudgetRequestForm.tsx`, `components/budget/BudgetRequestItem.tsx`, `components/budget/BudgetWorkspace.tsx`, `components/budget/types.ts`
- `lib/db-budget.ts`
- `app/api/budget-requests/route.ts`, `app/api/documents/route.ts`
- `components/documents/NewDocumentForm.tsx`
- `components/ui/icons.tsx`, `components/ui/Sidebar.tsx`
- `styles/components.css`
- `app/layout.tsx`

**Database migration required:** `supabase/migrations/0015_phase85_quick_wins.sql` adds one nullable column (`budget_requests.needed_by`). Apply it in Supabase (SQL editor, or however you've been running the earlier migrations) before or right after deploying — the code tolerates the column being briefly absent (defaults to `null`), but the "needed by" field won't save until it's there.

After applying, `npm run build` and redeploy as usual. No new npm dependencies.

## What this adds

Seven small, mostly-independent improvements, all scoped to "wire an existing backend capability into the UI" rather than new subsystems:

1. **Lead form** (Pipeline) — phone and notes fields, both already accepted by the backend, just never exposed. Now shown on each lead card too.
2. **Expense form** (Budget) — a date field (previously silently defaulted to today, no way to backdate) and a receipt link field, now shown as a "Receipt" link on each logged expense.
3. **Invoice form** (Budget) — a due-date field. This is what the existing "overdue" status logic depends on; it could never fire before because nothing ever set a due date.
4. **Budget request "needed by" date** — the one item here with a small schema change (see migration above). The original brief described this as "surface the quotation-attach endpoint inline," but on closer inspection that already exists (every budget request card has always had an inline "add quote" form right below it) — the real, actually-missing gap was a deadline field, so that's what got built instead.
5. **Document recipient override** — recipient name/email are otherwise always derived from the linked lead/engagement. A "Send to someone else…" toggle on the generate form now lets you override either field for the one-off case, without touching the normal auto-derived path.
6. **Dark mode toggle** — the dark color tokens already existed in `styles/design-tokens.css` (both automatic OS-preference matching and a manual override), there was just no switch anywhere. Now there's a "Dark mode / Light mode" button at the bottom of the sidebar (and the mobile drawer), persisted per-browser, applied before first paint so there's no flash of the wrong theme on reload.
7. **Lead admission deep link** — marking a lead "admitted" now links straight to the new customer record on the Customers page (scrolled to and highlighted) instead of a plain "see Customers" link. Honest scoping note: there's no per-customer detail page/route yet (a real gap, tracked in Cluster C of the backlog), so this highlights the right card on the list rather than pretending a full detail route exists — still a real improvement over the static link it replaces.

**Also fixed in passing:** two previously-flagged, still-broken instances of a bad CSS variable (`var(--v2-space-5)`, which doesn't exist in the token scale — it jumps space-4 → space-6) that were silently collapsing some flex gaps to zero: the sidebar's own nav spacing, and the Budget workspace's tab spacing. Both were noted as carried-forward gaps in earlier build-guide entries and are now closed.

## What was verified

- `npx tsc --noEmit` and `npm run build` — both clean.
- Full API round-trip smoke test against local SQLite for all four extended create forms (lead with phone/notes, expense with date/receipt, invoice with due date, budget request with needed-by) — all fields saved and returned correctly.
- Lead admission flow smoke-tested end to end (new → contacted → assessed → admitted), confirming `customerId` comes back and the Customers page highlight/scroll works.
- Document generation smoke-tested with a recipient override — confirmed the override reaches both the rendered document body and the stored record.
- Playwright screenshots at desktop (1440px) and mobile (390px), light and dark, covering every touched screen — no horizontal overflow anywhere, dark mode renders correctly (including the Gantt view, whose date rendering this phase's bug fix also touches), and the theme choice survives a page reload.

## Honest gaps

- The Gantt/Calendar Postgres date-parsing fix (`lib/db-driver.ts`) still hasn't been confirmed against your actual production Postgres from this sandbox — please double check the Gantt/Calendar views on the live deployment if you haven't already since applying it.
- The "needed by" field is new to the schema — until the migration runs, existing budget requests will simply show no "needed by" date (same as any other request where it was left blank), not an error.
- The customer deep-link only works within the same browser session that performed the admission (it's tracked in local component state, not persisted) — a lead that was already admitted before a page load falls back to the plain "see Customers" link, same as before this phase.
