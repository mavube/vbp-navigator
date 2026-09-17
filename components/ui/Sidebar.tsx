"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useNavProgress } from "@/components/ui/NavProgress";
import { NAV_GROUP_ORDER, NAV_LINKS, type NavLinkMeta } from "@/components/ui/navConfig";
import {
  IconAdvisor,
  IconArchitecture,
  IconBudget,
  IconCapabilities,
  IconClasses,
  IconClose,
  IconCollapse,
  IconCompensation,
  IconCustomers,
  IconDashboard,
  IconDocuments,
  IconMemory,
  IconMenu,
  IconPipeline,
  IconProspects,
  IconRequests,
  IconSignOut,
  IconTasks,
} from "@/components/ui/icons";

const NAV_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  "/dashboard": IconDashboard,
  "/": IconArchitecture,
  "/advisor": IconAdvisor,
  "/memory": IconMemory,
  "/tasks": IconTasks,
  "/pipeline": IconPipeline,
  "/classes": IconClasses,
  "/service-requests": IconRequests,
  "/capabilities": IconCapabilities,
  "/budget": IconBudget,
  "/compensation": IconCompensation,
  "/prospects": IconProspects,
  "/customers": IconCustomers,
  "/documents": IconDocuments,
};

type NavGroup = { label: string; links: NavLinkMeta[] };

// Built from the shared components/ui/navConfig.ts (v3.0 roadmap Phase
// 11) rather than its own literal — see that file's comment for why:
// the new Topbar needs the same href → label → group mapping to turn a
// route into a page title, and two hand-maintained copies would drift
// the first time a link is renamed or reordered.
const GROUPS: NavGroup[] = NAV_GROUP_ORDER.map((label) => ({
  label,
  links: NAV_LINKS.filter((l) => l.group === label),
}));

const COLLAPSE_KEY = "vbp-sidebar-collapsed";

interface Badges {
  tasksOverdue: number;
  blockersHighImpactOpen: number;
}

function NavContent({
  pathname,
  onNavigate,
  startNav,
  collapsed,
  badges,
}: {
  pathname: string;
  onNavigate: () => void;
  startNav: (href: string) => void;
  collapsed: boolean;
  badges: Badges | null;
}) {
  return (
    <>
      <Link
        href="/"
        className="v2-sidebar-brand"
        title="VBP Navigator"
        onClick={() => {
          startNav("/");
          onNavigate();
        }}
      >
        {collapsed ? "VBP" : <>VBP <span>Navigator</span></>}
      </Link>
      <nav className="v2-sidebar-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="v2-sidebar-group">
            {!collapsed && <p className="v2-sidebar-group-label">{group.label}</p>}
            {group.links.map((link) => {
              const active = pathname === link.href;
              const Icon = NAV_ICONS[link.href];
              const badgeCount = link.badgeKey && badges ? badges[link.badgeKey] : 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    startNav(link.href);
                    onNavigate();
                  }}
                  title={collapsed ? link.label : undefined}
                  className={`v2-sidebar-link ${active ? "v2-sidebar-link-active" : ""} ${collapsed ? "v2-sidebar-link-collapsed" : ""}`}
                >
                  <span style={{ position: "relative", display: "inline-flex" }}>
                    <Icon className="v2-sidebar-icon" />
                    {collapsed && badgeCount > 0 && <span className="v2-sidebar-dot" aria-hidden="true" />}
                  </span>
                  {!collapsed && (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.label}</span>
                      {badgeCount > 0 && <span className="v2-sidebar-badge">{badgeCount}</span>}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

// v3.0 roadmap Phase 11 (Cluster D) — closes three gaps the audit named
// on this exact view: "no live count badges... no collapse/rail mode;
// no user/org identity block or sign-out in the shell." Dark-mode
// toggle moves to the new Topbar (components/ui/Topbar.tsx) — it reads
// more naturally as part of a persistent header alongside search and
// notifications than sitting at the bottom of a rail that can now
// collapse to icons-only, and Topbar is new precisely because it's
// where this class of control belongs (see the enhancement backlog's
// own Cluster D wording).
export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Collapse/rail mode is a desktop affordance — the mobile drawer
  // (see the @media block in styles/components.css) is a full-width
  // overlay by design, so a stored "collapsed" preference from a
  // desktop session should never hide labels there. Tracked with a
  // live matchMedia listener (not a one-time check) so rotating a
  // tablet or resizing a window updates it without a reload.
  const [isDesktop, setIsDesktop] = useState(true);
  const [badges, setBadges] = useState<Badges | null>(null);
  const start = useNavProgress();
  const effectiveCollapsed = collapsed && isDesktop;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Best-effort — private browsing/blocked storage just starts expanded.
    }
    const mq = window.matchMedia("(min-width: 961px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.summary) return;
        setBadges({ tasksOverdue: data.summary.tasksOverdue ?? 0, blockersHighImpactOpen: data.summary.blockersHighImpactOpen ?? 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Best-effort, same as above.
      }
      return next;
    });
  }

  function startNav(href: string) {
    if (href !== pathname) start();
  }

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
        {badges && (badges.tasksOverdue > 0 || badges.blockersHighImpactOpen > 0) && (
          <span className="v2-sidebar-dot" style={{ position: "static", marginLeft: "auto" }} aria-label="Items need attention" />
        )}
      </header>

      {open && <div className="v2-sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`v2-sidebar ${open ? "v2-sidebar-open" : ""} ${effectiveCollapsed ? "v2-sidebar-collapsed" : ""}`}>
        <NavContent pathname={pathname} onNavigate={() => setOpen(false)} startNav={startNav} collapsed={effectiveCollapsed} badges={badges} />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <IdentityBlock collapsed={effectiveCollapsed} />
          <button
            type="button"
            onClick={toggleCollapsed}
            className="v2-theme-toggle v2-sidebar-collapse-btn"
            aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconCollapse style={{ transform: effectiveCollapsed ? "rotate(180deg)" : "none" }} />
            {!effectiveCollapsed && "Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}

function IdentityBlock({ collapsed }: { collapsed: boolean }) {
  const [identity, setIdentity] = useState<{ orgName: string; userEmail: string | null; signedIn: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setIdentity)
      .catch(() => {});
  }, []);

  if (!identity) return null;

  if (collapsed) {
    return (
      <div
        title={identity.userEmail ?? identity.orgName}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--v2-accent-soft)",
          color: "var(--v2-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.75rem",
          fontWeight: 700,
          margin: "0 auto",
        }}
      >
        {(identity.userEmail ?? identity.orgName).slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "8px var(--v2-space-3)",
        borderTop: "1px solid var(--v2-border)",
        paddingTop: "var(--v2-space-3)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {identity.userEmail ?? identity.orgName}
        </p>
        <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--v2-text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {identity.orgName}
        </p>
      </div>
      {identity.signedIn && (
        <form action="/auth/signout" method="post">
          <button type="submit" className="v2-icon-btn" title="Sign out" aria-label="Sign out">
            <IconSignOut />
          </button>
        </form>
      )}
    </div>
  );
}
