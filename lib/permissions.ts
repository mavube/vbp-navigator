// App-level permission checks for the API routes that use lib/db-driver
// (raw pg/SQLite, not a per-user Supabase session — see that file's RLS
// note). These re-implement, in application code, the same rule the SQL
// policies in supabase/migrations/0003_phase2_tasks.sql express — so the
// two should be read together, not as separate sources of truth.
//
// Local-dev (no Supabase configured): every check passes. There's no
// concept of "who's signed in" without real auth, and gating a
// zero-setup local demo would just be friction with no security benefit.

import { getCurrentOrgId } from "@/lib/current-org";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";

export interface UserContext {
  orgId: string;
  userId: string | null;
  roles: Array<{ role: AppRole; serviceId: string | null }>;
}

export async function getUserContext(): Promise<UserContext> {
  const orgId = await getCurrentOrgId();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { orgId, userId: null, roles: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgId, userId: null, roles: [] };

  const { data } = await supabase
    .from("role_assignments")
    .select("role, service_id")
    .eq("user_id", user.id);

  return {
    orgId,
    userId: user.id,
    roles: (data ?? []).map((r) => ({ role: r.role as AppRole, serviceId: r.service_id as string | null })),
  };
}

export function canManageService(ctx: UserContext, serviceId: string): boolean {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true; // local dev: no gate
  return ctx.roles.some(
    (r) =>
      r.role === "org_admin" ||
      ((r.role === "service_owner" || r.role === "contributor") && r.serviceId === serviceId)
  );
}

// Budget Approver is org-wide (Section 4 of the alignment doc — Anne at
// VBP), not scoped to a service, so this doesn't take a serviceId.
// Gates approving/rejecting a Budget Request and finalizing a
// Compensation Earning Service entry — the same "Anne approves" step
// in both flows.
export function canApproveBudget(ctx: UserContext): boolean {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true; // local dev: no gate
  return ctx.roles.some((r) => r.role === "org_admin" || r.role === "budget_approver");
}

// Phase 14 — gates Company Settings (org_settings) edits. Same
// authority as the Supabase RLS policy in migration 0020
// (org_settings_insert/update: has_role('org_admin')) — legal/bank
// details on every generated invoice are exactly the kind of
// organization-wide, high-consequence setting Org Admin already gates
// everywhere else in this app.
export function canManageOrgSettings(ctx: UserContext): boolean {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true; // local dev: no gate
  return ctx.roles.some((r) => r.role === "org_admin");
}

// Resolves a display name for byline-style fields (a comment's author,
// a service request's requester) that are denormalized at write time
// rather than always joined from `profiles` — see
// lib/db-comments.ts's file comment for why. When a real session
// exists, the signed-in user's own name wins over whatever the client
// sent (so nobody can post as someone else); local dev has no session
// to resolve, so it trusts the client-supplied name, same as every
// other local-dev permission check in this file.
export async function resolveDisplayName(ctx: UserContext, clientSupplied: string | undefined): Promise<string> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && ctx.userId) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("full_name").eq("id", ctx.userId).single();
    if (data?.full_name) return data.full_name;
  }
  return (clientSupplied ?? "").trim().slice(0, 200) || "Someone";
}
