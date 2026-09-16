# Phase 1 — Design System Foundation (2026-09-16)

Verified with a clean `npm run build` and a Playwright screenshot pass
(desktop + mobile) against a local dev server. See the build guide's
new "v3.0 roadmap — Phase 1" section for full detail.

## Files in this package (all at their normal repo path)

    styles/design-tokens.css          — new palette/type-scale/shadows (values only, same variable names)
    styles/components.css             — polished button/card/badge/input + new page-shell/nav/login styles
    components/ui/TopNav.tsx           — rebuilt nav: brand mark, active pill, mobile hamburger menu
    components/ui/Page.tsx             — NEW shared page-layout component
    app/tasks/page.tsx                 — now uses <Page>
    app/pipeline/page.tsx              — now uses <Page>
    app/classes/page.tsx               — now uses <Page>
    app/budget/page.tsx                — now uses <Page>
    app/compensation/page.tsx          — now uses <Page>
    app/service-requests/page.tsx      — now uses <Page>
    app/capabilities/page.tsx          — now uses <Page>
    app/login/page.tsx                 — rebuilt on the v2.0 token set (was still on v1.0 legacy classes)

## What did NOT change
The root "/" Service Architecture page (components/ServiceCards.tsx and
friends) is untouched — it's still v1.0's static content on the old
token set. That's deliberate: it's Phase 2's job (Service Catalogue +
Graph) to replace it, not this phase's, and you confirmed it should go
away once that happens.

## To apply
Copy these files into your repo at the same paths (overwriting the
existing ones, except Page.tsx which is new), commit, push via GitHub
Desktop as before. Vercel will redeploy automatically.

## After deploying
Worth a quick look on a real phone/browser: the Inter font loads via a
CSS @import (same pattern v1.0 already used successfully), which
should work fine on a normal internet connection even though it
couldn't be independently confirmed loading inside this session's own
restricted sandbox network. If it doesn't load for some reason, the
fallback system-font stack still looks solid on its own — nothing
breaks either way.
