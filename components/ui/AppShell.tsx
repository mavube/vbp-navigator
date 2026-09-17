"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Topbar } from "@/components/ui/Topbar";
import { NavProgressProvider } from "@/components/ui/NavProgress";

// v3.0 Phase 6a (UI/UX modernization). Wraps every page in the sidebar
// shell, except the same bare routes Sidebar itself already exempts
// (/login, /apply, /assess) — those bring their own full-bleed centered
// layout (.v2-login-wrap / .v2-public-wrap) and would look broken with
// a reserved left margin for a sidebar that isn't there. Checking the
// route here too (rather than only inside Sidebar) is what lets this
// component skip the margin-reserving wrapper div for those routes.
//
// v3.0 Responsiveness pass — NavProgressProvider wraps every route
// (bare ones included, in case they ever link elsewhere) so a click on
// any nav link gets an immediate top-of-viewport progress bar, not just
// silence until the destination page's own data finishes loading.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBare = pathname === "/login" || pathname.startsWith("/apply") || pathname.startsWith("/assess");

  if (isBare) {
    return <NavProgressProvider>{children}</NavProgressProvider>;
  }

  return (
    <NavProgressProvider>
      <div className="v2-shell">
        <Sidebar />
        <div className="v2-shell-main">
          <Topbar />
          {children}
        </div>
      </div>
    </NavProgressProvider>
  );
}
