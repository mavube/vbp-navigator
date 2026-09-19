import { Suspense } from "react";
import { Page } from "@/components/ui/Page";
import { BudgetWorkspace } from "@/components/budget/BudgetWorkspace";

export default function BudgetPage() {
  return (
    <Page
      title="Budget"
      description="Requests, expenses, and incoming invoices (vendor bills). Billing customers happens in Commercial Documents now. Not a general ledger: this tracks requests and commercial documents, not the books."
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
