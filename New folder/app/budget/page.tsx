import { Page } from "@/components/ui/Page";
import { BudgetWorkspace } from "@/components/budget/BudgetWorkspace";

export default function BudgetPage() {
  return (
    <Page
      title="Budget"
      description="Requests, expenses, and invoices — both incoming (vendor bills) and outgoing (billing customers). Not a general ledger: this tracks requests and commercial documents, not the books."
    >
      <BudgetWorkspace />
    </Page>
  );
}
