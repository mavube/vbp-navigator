"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Service Architecture" },
  { href: "/tasks", label: "Tasks" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/classes", label: "Classes" },
  { href: "/budget", label: "Budget" },
  { href: "/compensation", label: "Compensation" },
  { href: "/service-requests", label: "Requests" },
  { href: "/capabilities", label: "Capabilities" },
];

// Minimal top nav so v2.0's new modules (starting with Tasks) are
// reachable alongside v1.0's single-page Service Architecture view.
// Deliberately plain — a real nav (with the design system's full
// treatment) is worth revisiting once there are three or four modules,
// not just two.
export function TopNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      style={{
        display: "flex",
        gap: "var(--v2-space-4)",
        padding: "var(--v2-space-3) var(--v2-space-6)",
        borderBottom: "1px solid var(--v2-border)",
        background: "var(--v2-surface)",
        fontFamily: "var(--v2-font)",
        fontSize: "0.875rem",
      }}
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            color: pathname === link.href ? "var(--v2-accent)" : "var(--v2-text-muted)",
            fontWeight: pathname === link.href ? 600 : 500,
            textDecoration: "none",
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
