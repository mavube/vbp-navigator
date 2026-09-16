"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// v3.0 — Responsiveness pass. Client-side navigation between pages
// (clicking a sidebar link) can take a real, felt amount of time on a
// slow connection, and until the new page's own components mount there
// was previously zero visual acknowledgement that the click even
// registered — the exact "doesn't feel like it's clicked" complaint.
// This is a thin top-of-viewport progress bar, the same idea as
// GitHub's or YouTube's: start() fires the instant a nav link is
// clicked (synchronous React state, so it's not waiting on the network
// at all), and it clears itself once the pathname actually changes —
// which is the one reliable "navigation landed" signal the App Router
// gives a client component, since there's no router "navigation start"
// event to hook here instead.
const NavProgressContext = createContext<(() => void) | null>(null);

export function useNavProgress(): () => void {
  const start = useContext(NavProgressContext);
  return start ?? (() => {});
}

export function NavProgressProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const pathname = usePathname();
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    setActive(true);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    // Safety net only — covers a click that, for whatever reason, never
    // results in a pathname change (a failed navigation, a link to the
    // page you're already on that Sidebar didn't catch). Never left
    // stuck on-screen indefinitely.
    safetyTimer.current = setTimeout(() => setActive(false), 6000);
  }

  useEffect(() => {
    setActive(false);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    return () => {
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, [pathname]);

  return (
    <NavProgressContext.Provider value={start}>
      <div className={`v2-nav-progress ${active ? "v2-nav-progress-active" : ""}`} aria-hidden="true" />
      {children}
    </NavProgressContext.Provider>
  );
}
