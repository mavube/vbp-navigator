"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Sidebar } from "@/components/ui/Sidebar";

// v3.0 Phase 6a (UI/UX modernization). Wraps every page in the sidebar
// shell, except the same bare routes Sidebar itself already exempts
// (/login, /apply, /assess) — those bring their own full-bleed centered
// layout (.v2-login-wrap / .v2-public-wrap) and would look broken with
// a reserved left margin for a sidebar that isn't there. Checking the
// route here too (rather than only inside Sidebar) is what lets this
// component skip the margin-reserving wrapper div for those routes.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBare = pathname === "/login" || pathname.startsWith("/apply") || pathname.startsWith("/assess");

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <div className="v2-shell">
      <Sidebar />
      <div className="v2-shell-main">{children}</div>
    </div>
  );
}
