# Phase 8 — AI Operating Layer (Observe / Understand / Advise)

Eighth phase of the v3.0 roadmap (§19). This is the first half only, exactly as confirmed: **Observe/Understand/Advise**, not Forecast/Assist (drafting documents, demand forecasting) — that stays unbuilt until this half has been validated in real use.

## Before you apply this: you already did the one manual step

You've already added `ANTHROPIC_API_KEY` as a Secret environment variable in Vercel. That's the only piece of setup outside this zip. If you haven't redeployed since adding it, this deploy will pick it up.

## How to apply

Two files are **replacements of files that also changed in earlier phases** — apply carefully:
- `package.json` and `package-lock.json` now include the new `@anthropic-ai/sdk` dependency. If you've hand-edited either file since the last phase, merge rather than blindly overwrite; otherwise just replace them.

Everything else is new or a clean drop-in replacement:

**New:**
- `lib/ai-client.ts`
- `lib/ai-context.ts`
- `app/api/ai/observe/route.ts`
- `app/advisor/page.tsx`
- `components/advisor/AdvisorView.tsx`

**Replace:**
- `components/ui/icons.tsx`
- `components/ui/Sidebar.tsx`
- `package.json`
- `package-lock.json`
- `.env.example` (documentation only)
- `claude/vbp-navigator-os-v2-build-guide.md` (documentation only)

After applying, run `npm install` (picks up the new SDK dependency), then `npm run build` and redeploy as usual.

**No database migration.** This phase reads existing data only — it never writes anything back.

## What this adds

A new **Advisor** page (sidebar, Overview group, new sparkle icon) with one button: **Generate insights**. Nothing loads automatically — each click is a real, billed call to the Claude API, so it only happens when someone in your org actually asks for it.

When clicked, it sends a compact, org-scoped snapshot of your own data — every service's health status (from Phase 7), your overall KPI numbers, the highest-impact open blockers, overdue tasks, and pipeline counts by stage — to Claude, and asks for three things back:

- **Observations** — a few plain-language sentences on what's actually happening right now.
- **Connections** — specific, factual links between real things in your data (a service with no provider that also has a high-impact blocker open, say) — never generic filler, and never a fact that isn't actually in your data.
- **Recommendations** — up to 5 concrete next actions, each naming a real service, task, or blocker — never generic advice like "communicate better."

If the AI service isn't configured (no API key yet, or it hasn't redeployed since you added one), the page shows a clear "Not configured" message instead of breaking. If Claude's response doesn't come back in the expected format, the page shows it as plain text rather than silently dropping it.

## Data boundary

The Advisor only ever sees the one organization's own data — the snapshot is built from the exact same `orgId`-scoped queries every other part of this app already uses, so there's no separate "AI access control" layer to get right or wrong. It's condensed on purpose too: top 8 blockers by impact, up to 8 overdue tasks, pipeline counts rather than every lead's contact details — smaller and more relevant to hand a model than a full raw dump would be.

## What was verified

- `npm run build` and `npx tsc --noEmit` — both clean.
- The most important local test: with **no** `ANTHROPIC_API_KEY` set in this session's sandbox (matching how the app ran before you added the Vercel one), `POST /api/ai/observe` returned a clean `503` with the "not configured" message — not a crash, not a hang. The Advisor page rendered correctly both before and after clicking "Generate insights" in that state.
- Playwright screenshots on desktop (1440px) and mobile (390px) confirm the page renders correctly with no horizontal overflow.

## An honest gap — the one thing I could not verify myself

**The actual live Claude API call has not been tested end-to-end**, because this sandbox has no API key, and it shouldn't be handed your production one to test with. Everything up to and including the API request itself — how the org snapshot is built, how the request is constructed, every error path — is verified. What isn't is what comes back from a real call: whether the JSON parses cleanly every time, whether the observations/connections/recommendations are actually useful, whether 1024 max tokens is enough or too many.

**Please click "Generate insights" once this is live and tell me what you see** — especially if you ever get the "Unstructured response" fallback card, since that would mean the model isn't reliably following the requested format and the prompt may need tightening.

## Known limitations / not done yet

- Forecast/Assist (drafting documents, demand forecasting) — the second half of §19 — is not built. Revisit once this half has been used for real.
- No rate limiting or cost cap on the Advisor button — low-risk for a 5-person internal tool, but nothing stops rapid repeated clicks from racking up calls.
- No persistence of past insights — each generation is fresh and un-stored. That's deliberately left for Phase 9 (Organizational Memory), not built here.
- Capacity context in the snapshot only reads Tasks' assignee field, same limitation Phase 7's capacity intelligence already carries.
- No fiscal-year scoping on the snapshot — it's always a current, all-time-ish read.
