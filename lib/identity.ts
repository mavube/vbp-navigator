// v3.0 roadmap Phase 11 (Cluster D) — the Sidebar/Topbar "org/user
// identity block + sign-out" gap. A thin read-only composition over
// lib/permissions.ts's getUserContext and lib/organizations.ts's
// getOrgName — no new table, just naming what those two already know
// so the UI has one call to make instead of two.
import { getUserContext } from "@/lib/permissions";
import { getOrgName } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export interface Identity {
  orgName: string;
  userEmail: string | null;
  signedIn: boolean;
}

export async function getIdentity(): Promise<Identity> {
  const ctx = await getUserContext();
  const orgName = await getOrgName(ctx.orgId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Local dev, no Supabase configured — there's no session to read an
    // email from (see lib/current-org.ts's own local-dev note), but the
    // identity block still has something real to show rather than a
    // blank state.
    return { orgName, userEmail: null, signedIn: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { orgName, userEmail: user?.email ?? null, signedIn: !!user };
}
