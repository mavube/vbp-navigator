"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Architecture" },
  { href: "/tasks", label: "Tasks" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/classes", label: "Classes" },
  { href: "/budget", label: "Budget" },
  { href: "/compensation", label: "Compensation" },
  { href: "/service-requests", label: "Requests" },
  { href: "/capabilities", label: "Capabilities" },
];

// Redesigned 2026-09-16 (Phase 1, design-system pass). The original
// version was deliberately minimal, written when Tasks was the only
// new module — noted in its own comment as "worth revisiting once
// there are three or four modules." There are eight now. This adds a
// real brand mark, an active-link treatment beyond just bold+color,
// and a proper collapsed menu on narrow screens instead of letting
// eight links wrap awkwardly (the §24 "don't just shrink the desktop
// UI" requirement).
export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on route change rather than leaving it open
  // over the new page.
  useEffect(() => setOpen(false), [pathname]);

  if (pathname === "/login") return null;

  return (
    <header className="v2-nav">
      <div className="v2-nav-inner">
        <Link href="/" className="v2-nav-brand">
          VBP <span>Navigator</span>
        </Link>

        <button
          type="button"
          className="v2-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`v2-nav-links ${open ? "v2-nav-links-open" : ""}`}>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`v2-nav-link ${active ? "v2-nav-link-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
