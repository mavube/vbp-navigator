"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/ui/icons";

const STORAGE_KEY = "vbp-theme";

// Phase 8.5 (Quick Wins) — the dark-mode toggle the enhancement backlog
// flagged as missing. The tokens for dark mode already existed in
// styles/design-tokens.css (both a `prefers-color-scheme` media query
// and a manual `[data-theme="dark"]` override) — this component is
// genuinely just the missing switch, no token or component restyle
// needed, exactly as the audit found.
//
// Two explicit states only (light/dark), not a three-way "system"
// option — simplest thing that closes the actual gap (no manual
// control at all) without adding a settings surface this app doesn't
// otherwise have anywhere. Before a user ever toggles it, the app
// still follows the OS preference automatically (the existing
// prefers-color-scheme block) — this only kicks in once someone
// picks explicitly, and that pick is remembered per-browser via
// localStorage (see the inline script in app/layout.tsx that applies
// it before first paint, avoiding a flash of the wrong theme).
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    // No explicit choice yet — reflect whatever's currently rendering
    // (OS preference) so the icon/label matches reality on first show.
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort — a private-browsing/blocked-storage session just
      // won't persist the choice across reloads, which is fine.
    }
  }

  // Nothing rendered until mount resolves the real starting state —
  // avoids briefly showing the wrong icon before useEffect runs.
  if (theme === null) return <span className="v2-theme-toggle-placeholder" aria-hidden="true" />;

  return (
    <button
      type="button"
      onClick={toggle}
      className="v2-theme-toggle"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <IconSun /> : <IconMoon />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
