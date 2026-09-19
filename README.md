# /start Warm Lead Intelligence — Phase 1 (Intake Backbone)

First of six phases from `vbp-navigator-os-start-warm-lead-intelligence-plan.md` (the project doc capturing the full plan and its decisions). Replaces `/start`'s binary Training/Consulting menu with the real catalog-driven entry, and replaces the one-size "anything else?" textarea with the five-question general discovery pattern plus a category-specific adaptive question.

## What changed

### The entry menu is now catalog-driven, not a hardcoded binary choice

`/start` used to offer exactly two buttons — Training & Certification, or Consulting & Advisory — decided by a hardcoded `TRAINING_OFFERING_TYPES` set. Now it shows one button per real business-line `category` actually present in the Products & Services Catalog (up to the five real values the catalog already suggests: Training & Capability Development, Project Management & Implementation Advisory, Business Process & Value Advisory, Business Transformation & ICT Advisory, Technology & Digital Solutions), plus Certification pulled out as its own button (any item with `offeringType = "Certification Program"`, regardless of category), plus "I'm not sure" for a visitor who doesn't know which they need. A category with zero active catalog items simply doesn't show a button — nothing hardcoded, nothing to keep in sync by hand as Diallo adds real offerings.

Each button's description is the real catalog item names in that category (up to three, "…" if more) — not hand-written per-category copy that would just be a second thing to maintain.

### "I'm not sure" shows everything

Picking it drops the category filter entirely — the product picker shows every active catalog item, including Certification items. This is deliberately the simple version of "guided discovery": rather than building a recommendation classifier, it just removes the barrier and lets the same discovery questions do their job. Worth revisiting later if it doesn't work well enough in practice.

### The general discovery pattern replaces the single textarea

Every non-Certification item now asks the same five core questions (new `lib/discovery-questions.ts`, `DISCOVERY_QUESTIONS`): what you're trying to achieve, the main challenge, what's been tried, who it's for, and start timing — plus at most one adaptive question chosen by the selected item's `category` (`CATEGORY_ADAPTIVE_QUESTION`, keyed by the exact category string). A category with no adaptive question defined simply skips that question — never a placeholder. The optional "anything else?" field is kept, now positioned after the structured questions rather than being the only question asked.

The Certification path is untouched this round — still the same four questions from `lib/assessment-questions.ts` (PMP eligibility scoring is Phase 2, not this one).

### Contact capture moved to the end

Per the plan's "let the visitor explain the need first, then capture the contact needed for the next step" — full name, email, and phone now appear after the discovery/assessment questions, immediately before the Turnstile widget and submit button, instead of at the top of the form.

### No schema or API changes

Everything still lands in `prospects.assessment_answers`, already a flexible jsonb column — the five discovery answers and the one adaptive answer are just new keys in the same structure the Certification questions have always used. The public products endpoint already returned `category`; nothing needed to change there either.

## Files

- `lib/discovery-questions.ts` (new) — `DISCOVERY_QUESTIONS` (the five core questions) and `CATEGORY_ADAPTIVE_QUESTION` (one question per known category), same shared-definition pattern as `lib/assessment-questions.ts` so a later Conversation Brief (Phase 3) can reuse these exact labels.
- `components/public/StartForm.tsx` (modified) — the entry menu, category/certification/not-sure routing, the reordered form, and the new question rendering. `Track`/`TRAINING_OFFERING_TYPES`/`trackFor` are gone, replaced by `EntryChoice`/`CATEGORY_ORDER`/`orderedCategories`.

## Apply

Copy both files into their matching paths. No migration, no env var changes, no other files touched.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean; `/start/[org]` still builds as a real route.
- **9 assertions** against a freshly reset local database: 5 catalog items seeded across all five real categories plus one Certification item; public products endpoint confirmed to expose `category`/`offeringType` correctly with no price leaked; four submissions exercised — a Certification item (`source: "assessment"`), a Corporate Training item, a Project Management & Implementation Advisory item, and a Technology & Digital Solutions item (all `source: "apply"`, each carrying its own discovery answers including its category's specific adaptive-question key) — all 201. 9/9 passed.
- Playwright screenshots at 1280px: the six-card entry menu (all five real categories plus Certification plus "I'm not sure", each showing real catalog item names), the general discovery form for a Project Management & Implementation Advisory item (all five core questions plus its adaptive question, contact fields at the bottom), the Certification path unchanged, the Technology & Digital Solutions item showing its own distinct adaptive question ("How are you currently handling this?" vs. the advisory categories' "What has this situation affected most?"), and "I'm not sure" confirmed to list all 5 products (6 `<option>` elements including the placeholder).
- Mobile screenshot (390px) of the entry menu — no horizontal overflow, all six cards readable.
- Full regression sweep across 12 routes (core app pages plus `/apply/vbp`, `/assess/vbp`, `/start/vbp`) — all `200`, confirming the existing `/apply`/`/assess` redirect stubs still work unchanged.

## Not done yet / carried forward

This is Phase 1 of 6 from the plan doc. Still ahead, in order:
- The invoice-reconciliation design/migration pass (decided, not yet built) — needs to land before Phase 5's invoice-paid trigger depends on a single source of truth for revenue.
- Phase 2 — PMP eligibility, facts only (the four real PMI inputs checked against PMI's actual four-pathway table, no score).
- Phase 3 — Conversation Brief + a real Task created on promotion, on the Lead page.
- Phase 4 — existing-customer detection moved from promotion-time to `/start` submission-time.
- Phase 5 — the post-conversion opportunity engine (Engagement-completed, invoice-paid, class-completed, and organization-level grouping triggers).
- Phase 6 — card-based visual pass across the Customer/Lead pages, and the "Room to grow with [Name]" copy rewrite on the Customer page's suggestions section.

The Certification path's questions and framing are unchanged this round — still VBP's own intake questions, not PMI's real eligibility criteria (that's Phase 2).
