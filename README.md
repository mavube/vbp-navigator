# Phase 0 — Housekeeping (2026-09-16)

Two changes, both verified with a clean `npm run build`:

## 1. Remove the debug endpoint
Delete this file/folder from your repo entirely:
    app/api/debug/route.ts
(the whole `app/api/debug/` folder — nothing else needs it)

This was a temporary diagnostic route built to debug the production
database issue. It's resolved now, so this route has no place in the
shipped app (it was documented as throwaway from the start).

## 2. Replace components/budget/BudgetWorkspace.tsx
This fixes a real bug: the Budget page's services fetch silently turned
any failed request into an empty array, showing "No services in this
org yet" instead of a real error — indistinguishable from a legitimately
empty org. It now matches Tasks' existing pattern and shows
"Couldn't load services — try refreshing." on a real failure.

Just replace your existing file with the one in this zip at the same path:
    components/budget/BudgetWorkspace.tsx

## After applying
1. Commit and push (GitHub Desktop, same as before).
2. Vercel will redeploy automatically from the push.
3. Quick check: visit /budget once deployed — should look identical
   when things are working (this only changes behavior during a real
   outage, which is the point).

Build guide (`claude/vbp-navigator-os-v2-build-guide.md`) has been
updated in the project with the full deployment lessons-learned from
this week — nothing to apply there, just reference.
