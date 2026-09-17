import { Suspense } from "react";
import { Page } from "@/components/ui/Page";
import { BudgetWorkspace } from "@/components/budget/BudgetWorkspace";

export default function BudgetPage() {
  return (
    <Page
      title="Budget"
      description="Requests, expenses, and invoices — both incoming (vendor bills) and outgoing (billing customers). Not a general ledger: this tracks requests and commercial documents, not the books."
    >
      {/* BudgetWorkspace reads ?service= (v3.0 Phase 9's Service Health
          drill-down link) via useSearchParams() — same Suspense
          requirement as app/tasks/page.tsx. */}
      <Suspense fallback={<p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>}>
        <BudgetWorkspace />
      </Suspense>
    </Page>
  );
}
