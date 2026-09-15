// Role vocabulary for v2.0 — see claude/vbp-navigator-os-v2-alignment.md
// Section 4. Kept generic (not domain-named) so the same six words work
// for VBP's own service catalog or a future tenant's.

export const APP_ROLES = [
  "org_admin",
  "service_owner",
  "contributor",
  "requester",
  "budget_approver",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

// Org-wide roles apply to the whole organization, never to one service —
// role_assignments.service_id is null for these. Everything else
// (service_owner, contributor, requester) is scoped to a specific
// service_id.
export const ORG_WIDE_ROLES: ReadonlySet<AppRole> = new Set([
  "org_admin",
  "budget_approver",
  "viewer",
]);

export function isOrgWideRole(role: AppRole): boolean {
  return ORG_WIDE_ROLES.has(role);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  org_admin: "Org Admin",
  service_owner: "Service Owner",
  contributor: "Contributor",
  requester: "Requester",
  budget_approver: "Budget Approver",
  viewer: "Viewer",
};
