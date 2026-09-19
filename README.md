# Phase 3 — Conversation Brief + Follow-up Task on Promotion

Part of the `/start` Warm Lead Intelligence plan. Scope, per the confirmed build order:

> "A templated summary built only from what was actually captured ('why they came,' 'what they told us,' 'what they tried,' 'not yet established' for anything unanswered — never invented). Promoting a prospect to a Lead also creates one real Task (reusing the existing Tasks table — it already has `assigneeName` and `dueDate`) whose title is the next action and whose due date is the stated timing, rather than inventing a parallel 'follow-up' concept next to Tasks."

## What this ships

**Conversation Brief** — a small panel, shown on both the Prospect card and the Lead card, built purely from whatever the visitor actually answered on `/start`. Six lines: why they came, what they told us (the challenge), what they've tried, who it's for, timing, and anything else noted. A field nobody answered reads "Not yet established" — never a guess, never left blank. It's computed live from the stored `assessmentAnswers` every time the page renders (`lib/conversation-brief.ts`'s `buildConversationBrief()`), nothing new is persisted.

Three different question sets can produce those answers — general discovery, the older generic certification questions, and the PMP eligibility questions — each using its own field names for the same underlying idea (e.g. "why they came" is `desiredOutcome` on one path, `motivation` on another). `buildConversationBrief()` is the one place that reconciles all three into a single shape, so the Lead and Prospect pages only need to know about the Brief, not about which form the visitor happened to fill in.

**Follow-up Task on promotion** — promoting a Prospect to a Lead now also creates one real Task in the existing Tasks table:
- Title: `Follow up with <name> — <product>`
- Description: the full Conversation Brief text, plus the PMP eligibility statement when applicable — so whoever's assigned the follow-up has everything without needing to click into the Lead first
- Due date: a heuristic off the visitor's own stated timing — someone who said "Immediately" gets a due date 1 day out; "Later" or "Just exploring" gets 21 days; anything unrecognized or unstated defaults to a week out. The offset is always from *today*, not from the visitor's stated start date — the point is when the follow-up call should happen, not when they want to start.

Tasks has no `leadId` column (a deliberate earlier decision — Tasks/Requests stay internal capacity tracking, no schema change for this). So there's no durable link from the Lead back to the Task it spawned. The Task's own `description` carries the full context instead, and the Prospect page shows a one-time "→ Follow-up task created — see Tasks" link right after promotion (same pattern as the existing "→ Customer record created" link that appears after winning a Lead) — both are local component state, shown once, since neither table can look the link back up later.

## Two bugs found and fixed along the way

**1. General-discovery answers were being silently dropped at intake, for every submission since Phase 1.** `app/api/public/org/[slug]/prospects/route.ts`'s POST handler only captured `assessmentAnswers` when `source === "assessment"`. But the general-discovery path (the "why/what/who/timing" questions this phase's Brief is built to read) always sends `source: "apply"` — so every one of those five structured answers was accepted with a 201 and then thrown away, never actually stored. Nothing downstream — Prospect review, promotion, and now the Conversation Brief — ever saw them. This had been shipping since Phase 1; it went unnoticed because Phase 1's own verification only checked for a 201 response, never fetched the prospect back to confirm the answers round-tripped through storage. Fixed by capturing `assessmentAnswers` whenever the client sends them, for either source.

**2. Duplicate panels.** The Conversation Brief was added additively alongside two older panels (the generic-assessment "for the follow-up call" list on the Lead page, and the raw `key: value` answer dump on the Prospect page) that read the same underlying `assessmentAnswers` object with no awareness of what the Brief already shows. Two overlapping cases surfaced this in testing:
- A PMP lead's answers leaked one stray "What's prompting you to pursue this now?" line into the old generic-assessment panel, because this phase's two new PMP supplementary questions (added so PMP leads have real Brief content instead of "Not yet established" across the board) reuse the `motivation` key that panel also reads.
- A discovery-path prospect ("Baraka Discovery" in testing) showed the exact same six answers twice — once in the new Brief panel, once in the raw answer dump immediately below it.

Fixed with `lib/conversation-brief.ts`'s new `BRIEF_CONSUMED_KEYS` — the set of raw answer keys the Brief already reads — which both `ProspectItem.tsx` and `LeadItem.tsx` now filter their legacy panels against, key by key. This keeps those older panels useful for the fields the Brief genuinely doesn't cover (e.g. a hypothetical old-style lead's `experience`/`certification` answers) while eliminating the overlap, rather than just hiding one panel outright and losing that residual information.

## Files changed

- `lib/conversation-brief.ts` (new) — `buildConversationBrief()`, `formatConversationBriefText()`, `suggestFollowUpDueDate()`, `BRIEF_CONSUMED_KEYS`
- `lib/discovery-questions.ts` — extracted `START_TIMING_OPTIONS` as a named export, reused by the PMP question set
- `lib/pmp-eligibility.ts` — two new supplementary questions (`startTiming`, `motivation`) so PMP leads have real Brief content; carry zero weight in the eligibility computation itself
- `lib/db-prospects.ts` — `promoteProspectToLead()` now also creates the follow-up Task
- `app/api/prospects/[id]/promote/route.ts` — returns the new `taskId`
- `app/api/public/org/[slug]/prospects/route.ts` — bug fix: captures `assessmentAnswers` for either source (see above)
- `components/prospects/ProspectItem.tsx` — Conversation Brief panel, one-time "task created" link, `BRIEF_CONSUMED_KEYS` filtering
- `components/pipeline/LeadItem.tsx` — Conversation Brief panel, `BRIEF_CONSUMED_KEYS` filtering (both the PMP short-circuit and the per-key filter for the generic-assessment case)

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — clean
- Unit test (`verify_conversation_brief_unit.ts`, 24 assertions) — all pass: discovery/generic/PMP key mapping, empty-answers handling, text rendering, due-date heuristic ordering
- End-to-end test (`verify_phase3_e2e.js`, 17 assertions) — all pass against a freshly wiped local database: PMP and discovery prospects created, promoted, Task title/description/due-date content confirmed correct, non-PMP tasks confirmed to carry no PMP eligibility line, Lead's `assessmentAnswers` confirmed to carry through unchanged from the Prospect
- Full ~18-route regression sweep — all 200
- Visual check via screenshots of `/pipeline` and `/prospects` — confirmed no duplicate panels anywhere, including the two cases that originally surfaced the bug
