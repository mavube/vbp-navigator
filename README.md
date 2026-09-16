# Phase 6a — UI/UX Shell Modernization — apply instructions

Out-of-band pass, ahead of the v3.0 roadmap's numbered Phase 6 (Work Views + Blocker
Intelligence), in direct response to feedback on Phase 5's screenshots: the top nav
was overcrowded (11 links, wrapping to a second row) and every page was just "top
nav, then content — that's it." This replaces the top nav with a grouped side bar
and introduces a reusable, titled "Section" card primitive.

## 1. Delete this file

- `components/ui/TopNav.tsx` — replaced by `Sidebar.tsx` + `AppShell.tsx` below.

## 2. New files — add these

- `components/ui/icons.tsx` — 12 small hand-written inline SVG icons for the nav (no new npm dependency).
- `components/ui/Sidebar.tsx` — the grouped side bar (Overview / Delivery / Finance / Growth), collapsing to a slide-in drawer on mobile.
- `components/ui/AppShell.tsx` — wraps every page in the sidebar layout, except `/login`, `/apply`, `/assess` (same exemption TopNav had).
- `components/ui/Section.tsx` — a titled, card-framed content grouping (title + optional description + optional actions).

## 3. Replace these existing files (same relative paths)

- `components/ui/Page.tsx` — header is now a flex row with an optional `actions` slot; drops the old fixed top-nav-height offset.
- `components/documents/DocumentsWorkspace.tsx` — its three blocks (Generate / Needs attention / Closed) now use `Section`.
- `components/architecture/ArchitectureView.tsx` — the Internal Operation tab's two blocks (service chain, services) now use `Section`; the untouched Reference Case (GDC) tab is unaffected.
- `app/layout.tsx` — mounts `AppShell` instead of `TopNav`.
- `styles/components.css` — old `.v2-nav*` rules removed, new `.v2-shell`/`.v2-sidebar*`/`.v2-mobilebar*`/`.v2-section*` rules added. All other rules in this file are unchanged.
- `claude/vbp-navigator-os-v2-build-guide.md` — documentation only; already synced to the Claude project too.

## 4. What this gives you

Every existing page automatically gets the new shell — a persistent, grouped left
side bar on desktop (with small icons per link, active-state highlighting, and
section labels: Overview / Delivery / Finance / Growth) that collapses into a
hamburger-triggered slide-in drawer on narrow screens. `/login`, `/apply`, and
`/assess` are unaffected — they keep their own standalone centered layout with no
sidebar or mobile bar, exactly as before.

Two pages — Documents and Architecture (Internal Operation tab) — were also updated
to use the new `Section` component so there's a concrete example of the
"cards, sections" direction beyond just the shell change. Every other page still
renders correctly inside the new shell, just without the deeper per-page
sectioning yet (see "Not done yet" in the build guide).

## 5. No new dependencies

The nav icons are hand-written inline SVGs, not an icon library. No `package.json` changes in this phase.

## 6. Known limitations (documented, not hidden)

Only Documents and Architecture got the `Section` treatment — the other nine module
pages (Tasks, Pipeline, Classes, Budget, Compensation, Requests, Capabilities,
Prospects, Customers) still use their own pre-existing layout inside the new shell.
No dark-mode visual QA on the new sidebar/section CSS specifically. The mobile
drawer closes on backdrop tap, the hamburger, or route change — no swipe gesture.
See the build guide's Phase 6a section for the full list.
