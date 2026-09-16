# Phase 4 — Customer, Engagement & Public Entry Point — apply instructions

v3.0 roadmap, Phase 4 — the largest phase so far. Adds a public, unauthenticated
application/assessment entry point, and the Customer + Engagement entities a lead
graduates into on admission.

## 1. Run the new migration against your real Supabase project

`supabase/migrations/0012_phase4_customer_engagement.sql` — adds three new tables:
`prospects`, `customers`, `engagements`. Pure additive, no changes to any existing
table. Run it in the Supabase SQL editor (or your usual path) before deploying the
code below — the public `/apply`/`/assess` forms and the new `/prospects`/`/customers`
pages will error without it.

## 2. New files — add these (they don't exist yet in your repo)

- `lib/organizations.ts`
- `lib/db-prospects.ts`
- `lib/db-customers.ts`
- `lib/db-engagements.ts`
- `app/api/public/org/[slug]/services/route.ts`
- `app/api/public/org/[slug]/prospects/route.ts`
- `app/api/prospects/route.ts`
- `app/api/prospects/[id]/route.ts`
- `app/api/prospects/[id]/promote/route.ts`
- `app/api/customers/route.ts`
- `app/apply/[org]/page.tsx`
- `app/assess/[org]/page.tsx`
- `app/prospects/page.tsx`
- `app/customers/page.tsx`
- `components/public/PublicShell.tsx`
- `components/public/ApplyForm.tsx`
- `components/prospects/types.ts`
- `components/prospects/ProspectItem.tsx`
- `components/prospects/ProspectsWorkspace.tsx`
- `components/customers/types.ts`
- `components/customers/CustomersWorkspace.tsx`

## 3. Replace these existing files (same relative paths)

- `lib/db-leads.ts` — adds one new function (`getLead`), rest unchanged
- `app/api/leads/[id]/route.ts` — the admission → customer/engagement trigger
- `components/pipeline/LeadItem.tsx` — one small addition, shows a link after admission
- `components/ui/TopNav.tsx` — adds Prospects/Customers links, hides nav on public pages
- `styles/components.css` — adds the new `.v2-public-*` classes for the public pages
- `proxy.ts` — exempts `/apply`, `/assess`, `/api/public/**` from the auth redirect
- `claude/vbp-navigator-os-v2-build-guide.md` — documentation only; already synced to the Claude project too

## 4. What this gives you (production URLs)

VBP's real org slug is `vbp` (see `supabase/seed/vbp_bootstrap_full.sql`), so once
deployed:

- **`/apply/vbp`** — public application form, no login required
- **`/assess/vbp`** — public Professional Readiness Assessment intake, no login required
- **`/prospects`** (internal, needs login) — review everyone who came in through either
  public form; promote to a real Pipeline lead, or decline
- **`/customers`** (internal, needs login) — every customer, created automatically the
  moment a Pipeline lead is marked "admitted," with their Engagement(s)

Nothing about the existing Pipeline board changed except one thing: marking a lead
"admitted" now also creates (or reuses, if that email already has a customer record)
a Customer and an Engagement behind the scenes — no new steps for staff to learn.

## 5. Before sharing the public links

The `/apply` and `/assess` forms have no spam or bot protection yet (no CAPTCHA, no
rate limiting) — noted in the build guide as a known gap. Fine to leave running for
now since the links aren't public yet, but worth revisiting before you actually share
them.
