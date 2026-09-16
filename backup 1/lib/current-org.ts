// Resolves which org the current request belongs to, so route handlers
// don't each re-derive it. Two modes:
//
//   - Supabase configured: read the authenticated user, look up their
//     profiles.org_id. proxy.ts already guarantees a signed-in user got
//     this far (see proxy.ts), so a missing profile here is a genuine
//     setup problem (user exists in Supabase Auth but was never given a
//     profiles row) — surfaced as an error, not silently swallowed.
//   - Supabase not configured (local dev without a Supabase project):
//     a fixed local org id, matching how proxy.ts leaves the app open
//     when NEXT_PUBLIC_SUPABASE_URL isn't set. Keeps `npm run dev`
//     working with zero setup, same as v1.0.

import { createClient } from "@/lib/supabase/server";

export const LOCAL_DEV_ORG_ID = "local-dev";

export async function getCurrentOrgId(): Promise<string> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return LOCAL_DEV_ORG_ID;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No authenticated user — proxy.ts should have redirected to /login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (error || !profile) {
    throw new Error(`Signed in as ${user.email} but no profiles row exists yet — see README "Inviting people".`);
  }
  return profile.org_id as string;
}
