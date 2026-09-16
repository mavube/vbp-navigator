import { PublicShell } from "@/components/public/PublicShell";
import { ApplyForm } from "@/components/public/ApplyForm";

// Public, unauthenticated PMP Readiness Assessment intake — v3.0
// roadmap Phase 4 (§7). Directly closes the "not evidenced" gap flagged
// against VBP's own Professional Readiness Assessment CVS in
// claude/vbp-internal-service-architecture.md's Findings. Same URL
// shape as /apply — see that page's comment.
export default async function AssessPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return (
    <PublicShell>
      <ApplyForm orgSlug={org} mode="assess" />
    </PublicShell>
  );
}
