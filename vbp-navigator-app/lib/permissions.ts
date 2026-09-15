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
