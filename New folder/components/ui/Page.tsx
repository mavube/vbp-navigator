import { ReactNode } from "react";

interface PageProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

// The one shared layout every module page uses — replaces the
// maxWidth/padding/h1/p markup that used to be copy-pasted into all
// eight page.tsx files individually. A page's own content is
// everything specific to it; the shell (width, spacing, heading
// treatment) is the same everywhere, on purpose, and now lives in one
// place so a future design change touches one file instead of eight.
//
// v3.0 Phase 6a (UI/UX modernization): now rendered inside the sidebar
// shell (components/ui/AppShell.tsx) rather than directly under a top
// nav, so the min-height/offset math this used to do for a fixed top
// bar is gone — the header below is a sticky in-content toolbar, not a
// second nav bar. Added an optional `actions` slot so a page can put a
// primary button (e.g. "New document") next to its title instead of
// burying it in a card further down, matching the "cards and clear
// hierarchy" direction requested for this pass.
export function Page({ title, description, actions, children }: PageProps) {
  return (
    <main className="v2-page-shell">
      <div className="v2-page-header">
        <div className="v2-page-header-text">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="v2-page-header-actions">{actions}</div>}
      </div>
      <div className="v2-page-body">{children}</div>
    </main>
  );
}
