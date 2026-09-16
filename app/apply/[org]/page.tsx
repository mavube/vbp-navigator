import { PublicShell } from "@/components/public/PublicShell";
import { ApplyForm } from "@/components/public/ApplyForm";

// Public, unauthenticated entry point — v3.0 roadmap Phase 4 (§6). URL
// shape is /apply/<org-slug> (production VBP's slug is "vbp" — see
// supabase/seed/vbp_bootstrap_full.sql), so a future second org sponsor
// gets its own link with no code changes.
export default async function ApplyPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return (
    <PublicShell>
      <ApplyForm orgSlug={org} mode="apply" />
    </PublicShell>
  );
}
