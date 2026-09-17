"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useNavProgress } from "@/components/ui/NavProgress";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  IconAdvisor,
  IconArchitecture,
  IconBudget,
  IconCapabilities,
  IconClasses,
  IconClose,
  IconCompensation,
  IconCustomers,
  IconDashboard,
  IconDocuments,
  IconMenu,
  IconPipeline,
  IconProspects,
  IconRequests,
  IconTasks,
} from "@/components/ui/icons";

type NavLink = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

// Replaces the flat 11-link TopNav.tsx (v3.0 Phase 6a — UI/UX
// modernization). The flat row wrapped onto a second line at desktop
// width and read as one undifferentiated crowd of links; grouping by
// what the links are actually for (overview / day-to-day delivery /
// money / growth pipeline) turns "11 things" into "4 things with a
// few items each" — the standard fix for an overcrowded nav, and it
// also gives the app a persistent side bar instead of "top nav, then
// just content" for every page at once, since every page already
// shares this one component via app/layout.tsx.
const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
      { href: "/", label: "Architecture", icon: IconArchitecture },
      { href: "/advisor", label: "Advisor", icon: IconAdvisor },
    ],
  },
  {
    label: "Delivery",
    links: [
      { href: "/tasks", label: "Tasks", icon: IconTasks },
      { href: "/pipeline", label: "Pipeline", icon: IconPipeline },
      { href: "/classes", label: "Classes", icon: IconClasses },
      { href: "/service-requests", label: "Requests", icon: IconRequests },
      { href: "/capabilities", label: "Capabilities", icon: IconCapabilities },
    ],
  },
  {
    label: "Finance",
    links: [
      { href: "/budget", label: "Budget", icon: IconBudget },
      { href: "/compensation", label: "Compensation", icon: IconCompensation },
    ],
  },
  {
    label: "Growth",
    links: [
      { href: "/prospects", label: "Prospects", icon: IconProspects },
      { href: "/customers", label: "Customers", icon: IconCustomers },
      { href: "/documents", label: "Documents", icon: IconDocuments },
    ],
  },
];

function NavContent({
  pathname,
  onNavigate,
  startNav,
}: {
  pathname: string;
  onNavigate: () => void;
  startNav: (href: string) => void;
}) {
  return (
    <>
      <Link
        href="/"
        className="v2-sidebar-brand"
        onClick={() => {
          startNav("/");
          onNavigate();
        }}
      >
        VBP <span>Navigator</span>
      </Link>
      <nav className="v2-sidebar-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="v2-sidebar-group">
            <p className="v2-sidebar-group-label">{group.label}</p>
            {group.links.map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    startNav(link.href);
                    onNavigate();
                  }}
                  className={`v2-sidebar-link ${active ? "v2-sidebar-link-active" : ""}`}
                >
                  <Icon className="v2-sidebar-icon" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: "var(--v2-space-4)" }}>
        <ThemeToggle />
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const start = useNavProgress();

  // Close the mobile drawer on route change rather than leaving it open
  // over the new page (same behavior the old TopNav had).
  useEffect(() => setOpen(false), [pathname]);

  // Only fire the progress bar for a link that's actually going
  // somewhere new — clicking the page you're already on won't produce
  // a pathname change for NavProgressProvider to clear it on, so it'd
  // otherwise sit there until its safety timeout.
  function startNav(href: string) {
    if (href !== pathname) start();
  }

  // Public, unauthenticated pages (Phase 4's /apply, /assess) and /login
  // keep no app chrome at all — same exemption the old TopNav made, for
  // the same reasons: their links would 404-to-login for a visitor with
  // no account, and showing internal tooling would leak its existence.
  if (pathname === "/login" || pathname.startsWith("/apply") || pathname.startsWith("/assess")) return null;

  return (
    <>
      <header className="v2-mobilebar">
        <button
          type="button"
          className="v2-mobilebar-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
        <Link href="/" className="v2-mobilebar-brand" onClick={() => startNav("/")}>
          VBP <span>Navigator</span>
        </Link>
      </header>

      {open && <div className="v2-sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`v2-sidebar ${open ? "v2-sidebar-open" : ""}`}>
        <NavContent pathname={pathname} onNavigate={() => setOpen(false)} startNav={startNav} />
      </aside>
    </>
  );
}
