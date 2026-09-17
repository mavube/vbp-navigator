# VBP Navigator OS — Phase 12: AI Advisor expansion (Cluster E)

v3.0 roadmap, Cluster E from `claude/vbp-navigator-os-v3-enhancement-backlog.md` — the fifth and final cluster, built immediately after Phase 11 (Cluster D) in the same session. Full detail (design calls, what was verified, what's carried forward) is in the "v3.0 roadmap — Phase 12: AI Advisor expansion (Cluster E)" entry of `claude/vbp-navigator-os-v2-build-guide.md`, synced to the project. This README is the short version for applying the files.

## What this ships

Extends the AI Operating Layer's snapshot (`lib/ai-context.ts`) with five things the backlog audit named as blind spots:

- **Budget/compensation exposure** — pending/approved budget totals, finalized compensation count and net pay total, org-wide.
- **Task completion velocity** — tasks completed in the last 7/30 days.
- **Pipeline and prospect aging** — active leads and prospects, oldest-waiting-in-current-stage first.
- **Class enrollment** — each upcoming/active class's actual roster size (reframed from the backlog's "fill-rate," which isn't buildable — classes have no seat-capacity field in the schema).
- **Document and service-request backlog age** — oldest still-open documents and requests.

Trend/history vs. a prior snapshot is deliberately **not** built — it depends on the roadmap's still-unbuilt Phase 9 (Organizational Memory), and Diallo explicitly chose to skip it for now.

No schema changes — everything reuses existing columns and, where possible, data the snapshot builder already had in hand from Phase 8.

## Apply

1. No migration this phase.
2. Copy the three files in this package into the matching path in the repo, overwriting what's there.
3. `npm install` isn't needed — no new dependencies.
4. `npm run build` to confirm, then deploy as usual.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- Every new snapshot field checked against hand-seeded data via a temporary diagnostic route (built, used, deleted before packaging — same pattern as this project's earlier `/api/debug` endpoint) — all came back as exact matches.
- 6-assertion smoke test on the real routes (the `/api/ai/observe` 503-with-no-key path, and that the four modules whose data now feeds the AI context are unaffected) — 6/6 passing. Cluster D's full 23-assertion suite re-run against the same server — still 23/23, no cross-phase regression.
- Playwright screenshots at 1440px and 390px of `/advisor`, including a real "Generate insights" click — no horizontal overflow at either width.
- Every file in this package diffed byte-for-byte against the source tree before zipping.

## Files in this package (3)

```
lib/ai-context.ts
app/api/ai/observe/route.ts
components/advisor/AdvisorView.tsx
```

## Not done yet / carried forward

- The *content* of the model's reasoning over the richer snapshot hasn't been judged against a real Anthropic response yet — this sandbox has no configured API key. Worth a real "Generate insights" click once deployed.
- Task completion velocity's `updatedAt`-as-proxy will misread a task re-opened and re-completed within the same window.
- No FY scoping on any of the five new fields — same carried-forward gap the original Phase 8 snapshot has.
- This closes the enhancement backlog in full (Clusters A–E all built). What's left standing behind it is the original roadmap's Phase 9 (Organizational Memory) and Phase 10 (Scenario/What-if).
