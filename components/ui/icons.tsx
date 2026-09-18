import { SVGProps } from "react";

// UI/UX modernization pass (v3.0 Phase 6a) — a small inline icon set for
// the new sidebar nav. Deliberately hand-written SVGs rather than a new
// npm dependency (icon library), consistent with this project's existing
// practice of avoiding new dependencies where a lightweight in-house
// alternative works — 14 icons is well within "just write the paths."
// All 24x24, stroke-based, inherit color via currentColor so they pick
// up --v2-text-muted / --v2-accent automatically depending on nav state.

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconArchitecture(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 12h.01M15 12h.01M9 9h.01M15 9h.01" />
    </svg>
  );
}

// v3.0 roadmap Phase 7 — the /dashboard nav entry.
export function IconDashboard(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.5" />
    </svg>
  );
}

// v3.0 roadmap Phase 8 — the /advisor nav entry. A simple spark/star,
// distinct from every other glyph in this set (all outline shapes of
// real-world objects) on purpose, since this is the one screen backed
// by a model rather than a live database query.
export function IconAdvisor(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5c.7 3 1.8 4.1 4.8 4.8-3 .7-4.1 1.8-4.8 4.8-.7-3-1.8-4.1-4.8-4.8 3-.7 4.1-1.8 4.8-4.8Z" />
      <path d="M18.5 14c.4 1.7 1 2.3 2.7 2.7-1.7.4-2.3 1-2.7 2.7-.4-1.7-1-2.3-2.7-2.7 1.7-.4 2.3-1 2.7-2.7Z" />
    </svg>
  );
}

export function IconTasks(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12 2.2 2.2L16 9.5" />
    </svg>
  );
}

export function IconPipeline(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="5" cy="12" r="2.25" />
      <circle cx="12" cy="6" r="2.25" />
      <circle cx="12" cy="18" r="2.25" />
      <circle cx="19" cy="12" r="2.25" />
      <path d="M7 11.2 10 7.4M7 12.8l3 3.8M14 7.4l3 3.8M14 16.6l3-3.8" />
    </svg>
  );
}

export function IconClasses(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 3 8.5 12 13l9-4.5L12 4Z" />
      <path d="M6.5 10.8v4.7c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.7" />
    </svg>
  );
}

export function IconBudget(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  );
}

export function IconCompensation(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.7 9.6c0-1-1-1.7-2.4-1.7-1.5 0-2.6.8-2.6 1.9 0 2.8 5.3 1.4 5.3 4.1 0 1.2-1.2 2-2.7 2s-2.7-.7-2.8-1.8" />
    </svg>
  );
}

export function IconRequests(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h9l4.5 4.5v12.5H6z" />
      <path d="M15 3.5V8h4.5M9 13h6M9 16.5h6" />
    </svg>
  );
}

export function IconCapabilities(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v3.2M12 17.8V21M4.9 4.9l2.3 2.3M16.8 16.8l2.3 2.3M3 12h3.2M17.8 12H21M4.9 19.1l2.3-2.3M16.8 7.2l2.3-2.3" />
      <circle cx="12" cy="12" r="3.6" />
    </svg>
  );
}

export function IconProspects(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="8.5" r="3.2" />
      <path d="M3.5 20c.6-3.6 3.2-5.8 6.5-5.8s5.9 2.2 6.5 5.8" />
      <path d="M17 4.5c1.7.5 2.9 2 2.9 3.9S18.7 11.8 17 12.3M20.5 20c-.4-2.4-1.6-4.1-3.4-5" />
    </svg>
  );
}

export function IconCustomers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h6A1.5 1.5 0 0 1 13 6.5V20M13 11h4.5A1.5 1.5 0 0 1 19 12.5V20M4 20h15M7.5 8.5h1.5M7.5 12h1.5M7.5 15.5h1.5" />
    </svg>
  );
}

export function IconDocuments(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M14 3.5V8h4M9 12.5h6M9 15.8h4" />
    </svg>
  );
}

// Phase 13 (v3.0 roadmap Phase 9, §17 — Organizational Memory) — an
// open book, distinct from IconDocuments' single sheet-with-folded-
// corner, since Memory is a running log to read back through, not a
// generated artifact.
export function IconMemory(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.5c-1.5-1.2-3.6-1.7-5.5-1.3-.6.1-1 .6-1 1.2v10.8c0 .7.7 1.2 1.4 1 1.7-.4 3.6.1 5.1 1.2M12 6.5c1.5-1.2 3.6-1.7 5.5-1.3.6.1 1 .6 1 1.2v10.8c0 .7-.7 1.2-1.4 1-1.7-.4-3.6.1-5.1 1.2M12 6.5v12.9" />
    </svg>
  );
}

// Phase 14 (production readiness, Area 1) — the /commercial nav entry.
// A receipt with a currency mark, distinct from IconDocuments' plain
// sheet, since Commercial Docs are specifically money-bearing.
export function IconCommercial(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h12v17l-2.5-1.5L13 20.5l-2.5-1.5L8 20.5l-2-1.5V3.5Z" />
      <path d="M12 7.5v9M14.3 9c-.4-.5-1.2-.9-2.3-.9-1.3 0-2.4.6-2.4 1.7 0 2.2 4.7 1 4.7 3.2 0 1.1-1.1 1.7-2.4 1.7-1.1 0-2-.4-2.4-.9" />
    </svg>
  );
}

// Phase 14 — the /settings/company nav entry (a plain gear, the usual
// settings mark).
export function IconSettings(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2.06 2.06 0 1 1-2.92 2.92l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V19.8a2.06 2.06 0 0 1-4.12 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2.06 2.06 0 1 1-2.92-2.92l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H4.2a2.06 2.06 0 0 1 0-4.12h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.06 2.06 0 1 1 2.92-2.92l.06.06a1.7 1.7 0 0 0 1.87.34H10.4a1.7 1.7 0 0 0 1.03-1.56V4.2a2.06 2.06 0 0 1 4.12 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2.06 2.06 0 1 1 2.92 2.92l-.06.06a1.7 1.7 0 0 0-.34 1.87V10.4a1.7 1.7 0 0 0 1.56 1.03h.09a2.06 2.06 0 0 1 0 4.12h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
    </svg>
  );
}

// Phase 15 — the /settings/price-catalog nav entry (a price tag, for
// the predefined-services price list).
export function IconPriceCatalog(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.4 3.5h6.1a1 1 0 0 1 1 1v6.1a1 1 0 0 1-.3.7l-8.2 8.2a1 1 0 0 1-1.4 0l-6.1-6.1a1 1 0 0 1 0-1.4l8.2-8.2a1 1 0 0 1 .7-.3Z" />
      <circle cx="16.5" cy="7.5" r="1.4" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

// Phase 8.5 (Quick Wins) — the Sidebar theme toggle.
export function IconSun(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

// v3.0 roadmap Phase 11 (Cluster D) — the Sidebar collapse/rail toggle.
export function IconCollapse(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
      <path d="M15.5 9.5 13 12l2.5 2.5" />
    </svg>
  );
}

// v3.0 roadmap Phase 11 (Cluster D) — the Sidebar identity block's
// sign-out control and Topbar's identity menu.
export function IconSignOut(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H9" />
    </svg>
  );
}

// v3.0 roadmap Phase 11 (Cluster D) — the Topbar's global search field.
export function IconSearch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" />
    </svg>
  );
}

// v3.0 roadmap Phase 11 (Cluster D) — the Topbar's quick-add menu.
export function IconPlus(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </svg>
  );
}

// v3.0 roadmap Phase 11 (Cluster D) — the Topbar's notifications bell.
export function IconBell(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}
