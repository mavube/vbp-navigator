# Phase 5 — Document Generation Engine — apply instructions

v3.0 roadmap, Phase 5. Templated document generation across all 7 types the roadmap
named: proposal, quotation, invitation, approval request, confirmation, admission
communication, completion record.

## 1. Run the new migration against your real Supabase project

`supabase/migrations/0013_phase5_documents.sql` — one new table, `documents`. Pure
additive, no changes to any existing table. Run it before deploying the code below.

## 2. New files — add these

- `lib/document-templates.ts`
- `lib/document-context.ts`
- `lib/db-documents.ts`
- `app/api/documents/route.ts`
- `app/api/documents/[id]/route.ts`
- `app/api/documents/[id]/regenerate/route.ts`
- `app/api/documents/[id]/new-version/route.ts`
- `app/documents/page.tsx`
- `components/documents/types.ts`
- `components/documents/NewDocumentForm.tsx`
- `components/documents/DocumentItem.tsx`
- `components/documents/DocumentsWorkspace.tsx`

## 3. Replace these existing files (same relative paths)

- `lib/db-engagements.ts` — adds one new function (`getEngagement`), rest unchanged
- `lib/db-customers.ts` — adds one new function (`getCustomerById`), rest unchanged
- `lib/organizations.ts` — adds one new function (`getOrgName`), rest unchanged
- `components/ui/TopNav.tsx` — adds the "Documents" link
- `claude/vbp-navigator-os-v2-build-guide.md` — documentation only; already synced to the Claude project too

## 4. What this gives you

A new **Documents** page (needs login, same as every other internal page). Staff pick
a document type, pick which Lead or Engagement it's for (the picker switches
automatically based on type — proposals/quotations/invitations/approval requests need
a Lead since Customer doesn't exist pre-admission; confirmations/admission
communications/completion records need an Engagement), type in whatever's specific to
that document (a price, a date, a justification), and generate. From there: regenerate
while still a draft, submit for approval, approve or reject (same Budget Approver
authority as Budget Requests and Compensation), mark sent once approved, or open a new
version of an approved/rejected document.

Nothing about any other page changed — this is a purely additive phase.

## 5. Known limitations (documented, not hidden)

No PDF export and no real email sending yet — "mark sent" is a manual record that
staff sent it themselves outside the app. No spam/bot protection on the public
`/apply`/`/assess` forms from Phase 4 (documents can now be generated from
Prospects-turned-Leads, so this matters a bit more than before). See the build guide's
Phase 5 section for the full list.
