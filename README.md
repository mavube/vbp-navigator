# Phase 6b — Perceived Performance / Click Responsiveness Pass

An out-of-band pass, not one of the roadmap's 10 numbered phases — triggered by direct feedback after Phase 6 went live: "everything loading heavy... after clicking it doesn't feel like its clicked."

## What this is (and isn't)

Production Supabase is in `us-east-1`; the org is in Tanzania. That's a real ~12,000km round trip on every request, and it's the likely dominant cause of the *actual* slowness — but fixing that means migrating the production database to a closer region, a real infrastructure project with its own risk and downtime, which was discussed and **explicitly deferred** as a separate decision.

This pass fixes the part that's a code problem regardless of network distance: there was **zero visual acknowledgement that a click registered** until the network round trip finished. On real latency, that silence reads as "did that even work?" This pass makes every click respond instantly and synchronously, in the same frame it's clicked, independent of how long the actual request takes.

## How to apply

No database migration this time — pure frontend change. Just replace these files at the same paths (two are new, the rest are drop-in replacements of existing files):

**New:**
- `components/ui/Spinner.tsx`
- `components/ui/NavProgress.tsx`

**Replace:**
- `components/ui/AppShell.tsx`
- `components/ui/Sidebar.tsx`
- `components/ui/Button.tsx`
- `styles/components.css` — adds `.v2-nav-progress`, `.v2-btn-busy`, `.v2-spinner` rules to the end of the existing file; nothing removed.
- `components/tasks/TaskItem.tsx`
- `components/tasks/TaskKanban.tsx`
- `components/tasks/BlockersPanel.tsx`
- `components/tasks/NewTaskForm.tsx`
- `components/budget/BudgetRequestItem.tsx`
- `components/budget/InvoicesSection.tsx`
- `components/compensation/EntryItem.tsx`
- `components/compensation/NewEntryForm.tsx`
- `components/documents/DocumentItem.tsx`
- `components/pipeline/LeadItem.tsx`
- `components/prospects/ProspectItem.tsx`
- `components/service-requests/RequestItem.tsx`
- `components/classes/ClassItem.tsx`
- `components/collaboration/CommentThread.tsx`

Rebuild (`npm run build`) and redeploy as usual. No new npm dependencies.

## What changed, concretely

**Page navigation** — clicking any sidebar link now shows a thin purple progress bar across the very top of the screen immediately, before the new page has even started loading. It clears itself once the new page actually lands. This is the fix for "takes time to open."

**Every action button app-wide** — Mark done, Approve/Reject, Move to X, Save dates, Report blocker, Mark resolved, and every other button that triggers a server request now: disables itself and its sibling buttons in the same card the instant it's clicked (before the network request even starts), shows a small spinner, and changes its label to an "-ing…" form ("Approve" → "Approving…"). Where a card has several possible actions, only the one you actually clicked shows the spinner — the others just go quietly disabled until it resolves. This is the fix for "doesn't feel like it's clicked."

Two shared building blocks now exist for any future button: `components/ui/Spinner.tsx` (a small inline spinner), and `components/ui/Button.tsx`'s new `loading` prop (pass your existing busy-state boolean straight through and it handles the rest).

## What was verified

- `npm run build` — clean, TypeScript check included.
- Verified with **artificial network throttling** (Chrome DevTools Protocol, +900ms added latency) — without this, a local dev round trip is too fast to ever catch a busy state in a screenshot. Caught and screenshotted: a task's "Mark in progress" button mid-flight on both desktop (1440px) and mobile (390px), and the nav progress bar mid-transition.
- Re-verified `TaskKanban.tsx` (the most structurally-changed file this pass) still measures full page width with no horizontal overflow on both viewports, since it went through the most rework.
- `DocumentItem.tsx`'s busy states were code-reviewed line-for-line against the already-screenshot-verified `TaskItem.tsx` pattern (identical shape) and pass build/typecheck, but weren't separately screenshotted live — this session's local dev database has no seeded documents in it. Same code as what's already visually proven elsewhere, so low risk, but noting it rather than claiming a screenshot that doesn't exist.

## Known limitations / not done yet

- The database region migration (the bigger lever on *actual* speed, not just perceived) is still outstanding — a separate, deliberate decision for later.
- No page-level skeleton loading states — first-load "Loading…" text is unchanged. This pass targeted the click-feedback gap specifically.
- The `sw.js: Failed to convert value to 'Response'` service worker console errors noticed while diagnosing the earlier Documents 500 were never chased down (that 500 turned out to be a missing migration, not the service worker). Still open, not part of this pass.
