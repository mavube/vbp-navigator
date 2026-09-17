import { Suspense } from "react";
import { Page } from "@/components/ui/Page";
import { TaskBoard } from "@/components/tasks/TaskBoard";

export default function TasksPage() {
  return (
    <Page title="Tasks" description="List, Kanban, Gantt, and Calendar views of the same work, plus first-class blockers with an owner, an impact, and a required action.">
      {/* TaskBoard reads ?service=/&focus= (v3.0 Phase 9's Service Health
          drill-down links) via useSearchParams(), which requires a
          Suspense boundary to keep this page statically prerenderable —
          same pattern as app/customers/page.tsx since Phase 8.5. */}
      <Suspense fallback={<p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>}>
        <TaskBoard />
      </Suspense>
    </Page>
  );
}
