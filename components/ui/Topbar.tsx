"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNavProgress } from "@/components/ui/NavProgress";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { pageTitleFor } from "@/components/ui/navConfig";
import { IconBell, IconPlus, IconSearch, IconSignOut } from "@/components/ui/icons";
import type { SearchResult } from "@/lib/search";

interface AtRiskService {
  serviceId: string;
  serviceName: string;
  status: string;
  reasons: { text: string; href: string | null }[];
}
interface Notifications {
  tasksOverdue: number;
  blockersHighImpactOpen: number;
  atRiskServices: AtRiskService[];
}
interface Identity {
  orgName: string;
  userEmail: string | null;
  signedIn: boolean;
}

const RESULT_TYPE_LABEL: Record<SearchResult["type"], string> = {
  service: "Service",
  task: "Task",
  lead: "Lead",
  class: "Class",
  customer: "Customer",
  prospect: "Prospect",
};

// Every page that has an "Add X" section at its top already accepts
// being navigated to directly — quick-add is a menu of links into
// those existing forms, not a new modal-creation path. This app has no
// lightweight modal-form infrastructure to reuse across six different
// entity shapes, and building one just for this menu would duplicate
// what NewTaskForm/NewLeadForm/etc. already do well; documented here
// the same way this project has scoped prior "quick win" gaps to the
// simplest thing that actually closes them (see the Phase 10 build
// guide's Documents note for the precedent).
const QUICK_ADD: { href: string; label: string }[] = [
  { href: "/tasks", label: "Task" },
  { href: "/pipeline", label: "Lead" },
  { href: "/classes", label: "Class" },
  { href: "/customers", label: "Customer" },
  { href: "/prospects", label: "Prospect (log an inquiry)" },
  { href: "/budget", label: "Invoice or expense" },
  { href: "/service-requests", label: "Service request" },
  { href: "/documents", label: "Document" },
];

// v3.0 roadmap Phase 11 (Cluster D) — "Topbar: doesn't exist at all —
// desktop has zero persistent header." Adds global search, a quick-add
// menu, a notifications surface for critical blockers/overdue tasks,
// org/user identity + sign-out, a page title, and the dark-mode toggle
// (moved here from the bottom of Sidebar — see that file's comment).
// Desktop-only by design: the mobile drawer's existing hamburger bar
// already carries the brand and menu toggle, and cramming five more
// controls into that same narrow bar would make it worse, not better —
// a scoped choice, not an oversight (see styles/components.css's
// .v2-topbar media rule).
export function Topbar() {
  const pathname = usePathname();
  const start = useNavProgress();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notifications | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setSearchOpen(false), [pathname]);

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setNotifications)
      .catch(() => {});
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setIdentity)
      .catch(() => {});
  }, [pathname]);

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { cache: "no-store" });
      if (res.ok) {
        setResults(await res.json());
        setSearchOpen(true);
      }
    }, 250);
  }

  function go(href: string) {
    if (href !== pathname) start();
  }

  const notifCount = notifications ? notifications.tasksOverdue + notifications.blockersHighImpactOpen : 0;
  if (pathname === "/login" || pathname.startsWith("/apply") || pathname.startsWith("/assess")) return null;

  return (
    <div className="v2-topbar">
      <div className="v2-topbar-left">
        <span className="v2-topbar-title">{pageTitleFor(pathname)}</span>
      </div>

      <div className="v2-topbar-search">
        <IconSearch className="v2-topbar-search-icon" />
        <input
          type="search"
          placeholder="Search services, tasks, leads, classes…"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => results.length > 0 && setSearchOpen(true)}
          className="v2-topbar-search-input"
          aria-label="Global search"
        />
        {searchOpen && (
          <>
            <div className="v2-topbar-dropdown-catcher" onClick={() => setSearchOpen(false)} />
            <div className="v2-topbar-dropdown v2-topbar-search-results">
              {results.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--v2-text-faint)", padding: "var(--v2-space-2)" }}>No matches.</p>
              ) : (
                results.map((r) => (
                  <Link
                    key={`${r.type}-${r.id}`}
                    href={r.href}
                    onClick={() => {
                      go(r.href);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                    className="v2-topbar-result"
                  >
                    <span className="v2-topbar-result-type">{RESULT_TYPE_LABEL[r.type]}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--v2-text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.sublabel}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="v2-topbar-right">
        <div style={{ position: "relative" }}>
          <button type="button" className="v2-icon-btn" aria-label="Quick add" title="Quick add" onClick={() => setQuickAddOpen((v) => !v)}>
            <IconPlus />
          </button>
          {quickAddOpen && (
            <>
              <div className="v2-topbar-dropdown-catcher" onClick={() => setQuickAddOpen(false)} />
              <div className="v2-topbar-dropdown" style={{ right: 0, left: "auto", minWidth: 220 }}>
                {QUICK_ADD.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => { go(item.href); setQuickAddOpen(false); }} className="v2-topbar-result" style={{ gridTemplateColumns: "1fr" }}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button type="button" className="v2-icon-btn" aria-label="Notifications" title="Notifications" onClick={() => setNotifOpen((v) => !v)} style={{ position: "relative" }}>
            <IconBell />
            {notifCount > 0 && <span className="v2-sidebar-dot" aria-hidden="true" />}
          </button>
          {notifOpen && (
            <>
              <div className="v2-topbar-dropdown-catcher" onClick={() => setNotifOpen(false)} />
              <div className="v2-topbar-dropdown" style={{ right: 0, left: "auto", minWidth: 280 }}>
                {!notifications || notifCount === 0 && notifications.atRiskServices.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--v2-text-faint)", padding: "var(--v2-space-2)" }}>Nothing needs attention.</p>
                ) : (
                  <>
                    {notifications.tasksOverdue > 0 && (
                      <Link href="/tasks?focus=overdue" onClick={() => setNotifOpen(false)} className="v2-topbar-result" style={{ gridTemplateColumns: "1fr" }}>
                        ⏰ {notifications.tasksOverdue} overdue task{notifications.tasksOverdue === 1 ? "" : "s"}
                      </Link>
                    )}
                    {notifications.blockersHighImpactOpen > 0 && (
                      <Link href="/tasks?focus=blocked" onClick={() => setNotifOpen(false)} className="v2-topbar-result" style={{ gridTemplateColumns: "1fr" }}>
                        🚧 {notifications.blockersHighImpactOpen} high-impact open blocker{notifications.blockersHighImpactOpen === 1 ? "" : "s"}
                      </Link>
                    )}
                    {notifications.atRiskServices.map((s) => (
                      <Link
                        key={s.serviceId}
                        href={s.reasons[0]?.href ?? `/tasks?service=${s.serviceId}`}
                        onClick={() => setNotifOpen(false)}
                        className="v2-topbar-result"
                        style={{ gridTemplateColumns: "1fr" }}
                      >
                        ⚠️ {s.serviceName} at risk — {s.reasons[0]?.text ?? "see Capabilities"}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <ThemeToggle />

        {identity && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="v2-icon-btn"
              aria-label="Account"
              title={identity.userEmail ?? identity.orgName}
              onClick={() => setIdentityOpen((v) => !v)}
              style={{ borderRadius: "50%" }}
            >
              {(identity.userEmail ?? identity.orgName).slice(0, 1).toUpperCase()}
            </button>
            {identityOpen && (
              <>
                <div className="v2-topbar-dropdown-catcher" onClick={() => setIdentityOpen(false)} />
                <div className="v2-topbar-dropdown" style={{ right: 0, left: "auto", minWidth: 220, padding: "var(--v2-space-3)" }}>
                  <p style={{ margin: "0 0 2px", fontSize: "0.8rem", fontWeight: 600 }}>{identity.userEmail ?? "Local dev"}</p>
                  <p style={{ margin: "0 0 10px", fontSize: "0.75rem", color: "var(--v2-text-faint)" }}>{identity.orgName}</p>
                  {identity.signedIn && (
                    <form action="/auth/signout" method="post">
                      <button type="submit" className="v2-btn v2-btn-secondary" style={{ width: "100%", justifyContent: "center", padding: "6px 10px", fontSize: "0.8rem" }}>
                        <IconSignOut style={{ marginRight: 6 }} />
                        Sign out
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
