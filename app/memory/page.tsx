import { Page } from "@/components/ui/Page";
import { MemoryWorkspace } from "@/components/memory/MemoryWorkspace";

// v3.0 roadmap Phase 9 (Organizational Memory, §17), built as this
// project's own Phase 13. "Decision/lesson capture ... feeding
// directly into what the AI layer built in Phase 8 can surface as
// historical pattern-matching" — the roadmap's own scope. See
// lib/ai-context.ts's `recentMemory` field for the AI-layer half.
export default function MemoryPage() {
  return (
    <Page
      title="Memory"
      description="A running log of decisions and lessons anyone in the org can add to — tied to a service when it's about one, org-wide when it isn't. The Advisor reads the most recent entries here as history when it reasons about what's happening now."
    >
      <MemoryWorkspace />
    </Page>
  );
}
