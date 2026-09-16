// Resolves a public-facing org slug (the "vbp" in /apply/vbp) to a real
// org id — used only by the unauthenticated public routes
// (app/api/public/**), which have no session to derive org_id from the
// way lib/current-org.ts does for logged-in staff.
//
// Local dev (no Supabase configured) has no `organizations` table at
// all — lib/current-org.ts's LOCAL_DEV_ORG_ID is a fixed string, not a
// row. To keep `npm run dev` zero-setup the way every other module in
// this app does, any slug resolves to that same fixed local org here
// too — so /apply/vbp and /apply/anything-else behave identically in
// local dev, and only a real Postgres org's real slug matters once this
// is deployed.

import { IS_POSTGRES, getPgPool } from "@/lib/db-driver";
import { LOCAL_DEV_ORG_ID } from "@/lib/current-org";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export async function getOrgBySlug(slug: string): Promise<OrgSummary | null> {
  if (!IS_POSTGRES) {
    return { id: LOCAL_DEV_ORG_ID, name: "VBP (local dev)", slug };
  }
  const res = await (await getPgPool()).query(
    `SELECT id, name, slug FROM organizations WHERE slug = $1`,
    [slug]
  );
  return res.rows[0] ?? null;
}

// The reverse lookup — needed by the Phase 5 document templates, which
// need the org's real display name (not its slug) to write "on behalf
// of <org>" into generated text. Same local-dev fallback as above.
export async function getOrgName(orgId: string): Promise<string> {
  if (!IS_POSTGRES) return "VBP (local dev)";
  const res = await (await getPgPool()).query(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
  return res.rows[0]?.name ?? "This organization";
}
