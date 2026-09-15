import { NextResponse } from "next/server";
import { IS_POSTGRES, DATABASE_URL } from "@/lib/db-driver";
import { getCurrentOrgId } from "@/lib/current-org";
import { listServices } from "@/lib/db-services";

// Temporary diagnostic endpoint — NOT part of the normal app. Exists
// only to answer one question fast, without digging through Vercel
// runtime logs: what is this specific deployment's environment/data
// actually seeing? Never returns secret values, only booleans/lengths/
// error messages, so it's safe to hit directly in a browser while
// signed in. Delete this file once the "no data loading" issue is
// diagnosed — it has no place in the shipped app.
export async function GET() {
  const result: Record<string, unknown> = {
    isPostgres: IS_POSTGRES,
    databaseUrlLooksLikePostgres: /^postgres(ql)?:\/\//i.test(DATABASE_URL),
    databaseUrlIsDefault: DATABASE_URL === "file:./dev.db",
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  try {
    const orgId = await getCurrentOrgId();
    result.orgId = orgId;
    result.orgIdError = null;
  } catch (err) {
    result.orgId = null;
    result.orgIdError = err instanceof Error ? err.message : String(err);
  }

  if (result.orgId) {
    try {
      const services = await listServices(result.orgId as string);
      result.servicesCount = services.length;
      result.servicesError = null;
    } catch (err) {
      result.servicesCount = null;
      result.servicesError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(result);
}
