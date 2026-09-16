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
