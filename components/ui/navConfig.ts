// Shared nav vocabulary for Sidebar.tsx and Topbar.tsx (v3.0 roadmap
// Phase 11, Cluster D, added the Topbar — it needs to turn the current
// route into a page title/breadcrumb, and duplicating Sidebar's GROUPS
// list to do that would drift the two out of sync the first time a
// route is renamed). Icons stay imported directly by Sidebar (the only
// place that renders them); this file is just the href → label → group
// mapping both components read.

export interface NavLinkMeta {
  href: string;
  label: string;
  group: string;
  badgeKey?: "tasksOverdue" | "blockersHighImpactOpen";
}

export const NAV_LINKS: NavLinkMeta[] = [
  { href: "/dashboard", label: "Dashboard", group: "Overview" },
  { href: "/", label: "Architecture", group: "Overview" },
  { href: "/advisor", label: "Advisor", group: "Overview" },
  { href: "/memory", label: "Memory", group: "Overview" },
  { href: "/tasks", label: "Tasks", group: "Delivery", badgeKey: "tasksOverdue" },
  { href: "/pipeline", label: "Pipeline", group: "Delivery" },
  { href: "/classes", label: "Classes", group: "Delivery" },
  { href: "/service-requests", label: "Requests", group: "Delivery" },
  { href: "/capabilities", label: "Capabilities", group: "Delivery" },
  { href: "/budget", label: "Budget", group: "Finance" },
  { href: "/compensation", label: "Compensation", group: "Finance" },
  { href: "/prospects", label: "Prospects", group: "Growth" },
  { href: "/customers", label: "Customers", group: "Growth" },
  { href: "/documents", label: "Documents", group: "Growth" },
  { href: "/commercial", label: "Commercial Docs", group: "Growth" },
  { href: "/settings/company", label: "Company Settings", group: "Overview" },
  { href: "/settings/price-catalog", label: "Products & Services", group: "Overview" },
];

export const NAV_GROUP_ORDER = ["Overview", "Delivery", "Finance", "Growth"];

export function pageTitleFor(pathname: string): string {
  const link = NAV_LINKS.find((l) => l.href === pathname);
  if (link) return link.label;
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/pipeline")) return "Pipeline";
  if (pathname.startsWith("/customers")) return "Customers";
  return "VBP Navigator";
}
