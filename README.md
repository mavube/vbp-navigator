# VBP Navigator OS — Products & Services Catalog: Category/Type Dropdowns

The second of three confirmed next steps from Diallo's post-Phase-G feedback. His own words on the problem: "currently manually filled in and this invites human errors or naming inconsistency... we should have an option to select."

## What was wrong

`components/settings/PriceCatalogManager.tsx`'s Add form used a free-text `<Input>` for Category (with a `<datalist>` of five suggested values a user could ignore entirely) and a plain, unconstrained `<Input>` for Type — no suggestions at all. Nothing stopped two catalog items meaning the same thing from being saved as "Training & Capability Development" and "training and capability development," which is exactly the naming-inconsistency risk Diallo flagged. The inline Edit form had the same problem.

## What changed

- **`components/settings/PriceCatalogManager.tsx`** (the only file touched):
  - Both Category and Type are now real `<select>` dropdowns via a new shared `SuggestSelect` component, used in both the Add form and the inline per-item Edit form.
  - `CATEGORY_SUGGESTIONS` is unchanged — the same five values already in the app (`Training & Capability Development`, `Business Transformation & ICT Advisory`, `Project Management & Implementation Advisory`, `Business Process & Value Advisory`, `Technology & Digital Solutions`), now enforced as real options instead of loose suggestions.
  - A new `TYPE_SUGGESTIONS` list (`Certification Program`, `Corporate Training / Course`, `Advisory Engagement`, `Consulting Retainer`, `One-off Service`) gives Type the same dropdown treatment Category already had. **These five values are my own proposal, drawn from offering types already visible elsewhere in the catalog data — they have not been individually confirmed by Diallo the way the Category list was.** Worth a quick look before this ships, and easy to adjust: they're a single array literal.
  - Every dropdown keeps an **"Other (specify)…"** escape hatch that reveals a paired free-text field, auto-focused when chosen. This isn't a hard enum — it's a guided default that still allows anything a fixed list can't anticipate, without reopening the original naming-drift problem (an "Other" value is still exactly what the user types, verbatim).
  - The Add form now resets cleanly after a successful submit (previously true for text inputs; the new dropdowns needed a small remount trick — a `formResetKey` counter — to reliably clear back to the placeholder state rather than getting stuck showing a stale selection).
  - Editing a pre-existing item — including one with a custom or legacy value that isn't in either suggestion list — correctly opens with "Other (specify)…" selected and that exact value pre-filled, never silently blanked.
  - Removed the old `<datalist id="category-suggestions">` block, no longer needed.

## Why no migration or API changes were needed

`app/api/price-catalog/route.ts` and `app/api/price-catalog/[id]/route.ts` already store `category` and `offeringType` as plain length-capped strings with no enum/allow-list validation. The dropdown is purely a UI guardrail — it constrains what a user is guided to pick, not what the database or API will accept. That also means every existing catalog item, however it was entered before this fix, continues to work with zero data migration.

## Apply

1. Copy `components/settings/PriceCatalogManager.tsx` into the matching path, overwriting what's there.
2. `npm run build` to confirm, then deploy.
3. Nothing else required — no migration, no API change, no data backfill.

## Verified before packaging

- `npx tsc --noEmit` and `npm run build` both clean.
- **14 new assertions**, run against a freshly reset local database: a known Category + known Type item created and persisted exactly; an item created with values outside both suggestion lists (simulating "Other") stored verbatim; a legacy item created with no category/type at all still creates and edits fine (empty string, not an error); an existing item's category edited to a different known value; a legacy item's category edited to a brand-new custom value and stored verbatim; and a final list-count check. 14/14 passed.
- Playwright screenshots at 1280px confirming: the catalog list unaffected, the Category dropdown revealing the "Other" text field when selected (auto-focused, correctly placed), a known Type value selected cleanly, the Add form returning to its placeholder/empty state immediately after a successful submit (proving the `formResetKey` remount actually resets the dropdowns, not just the text fields), and — the case most likely to break silently — opening Edit on a legacy item whose category had been set to a custom value outside any suggestion list, showing "Other (specify)…" correctly selected with that exact text pre-filled rather than blanked.
- Full page-route regression sweep across 10 core routes (`/tasks`, `/pipeline`, `/classes`, `/commercial`, `/customers`, `/dashboard`, `/documents`, `/prospects`, `/settings/company`, `/settings/price-catalog`) — all returned `200` after this change.
- The single modified file diffed byte-for-byte against the live source tree before packaging.

## Not done yet / carried forward

- `TYPE_SUGGESTIONS`'s specific five values are proposed, not confirmed — flag for a quick sanity check with Diallo before or shortly after this ships.
- Still open from the same post-Phase-G feedback: (3) building the same "structured facts, not raw JSON" treatment already delivered for Leads onto Customer, Product, and Invoice/Quote/Proposal pages — Diallo's "decision-supporting system, not QuickBooks" direction.
- The production "empty white space" sidebar-gap report remains unresolved and explicitly deferred by Diallo ("we will fix the ui later") — no code-level cause was found in investigation of any version of this app's delivered source; it needs either live DevTools inspection on the actual production page or confirmation of what's really deployed there before it can be diagnosed further.
- Everything already carried forward from the Lead assessment-data fix package is unchanged by this fix.
