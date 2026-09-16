import type { ReactNode } from "react";

// Shared wrapper for the unauthenticated public routes (/apply, /assess)
// — v3.0 roadmap Phase 4. No TopNav (see components/ui/TopNav.tsx),
// just a small brand mark and a centered card, so a public applicant
// never sees internal nav links or an implication they need an account.
export function PublicShell({ orgName, children }: { orgName?: string; children: ReactNode }) {
  return (
    <div className="v2-public-wrap">
      <span className="v2-public-brand">
        VBP <span>Navigator</span>
        {orgName ? ` · ${orgName}` : ""}
      </span>
      <div className="v2-public-card">{children}</div>
    </div>
  );
}
