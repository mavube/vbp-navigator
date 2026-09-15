import { BudgetWorkspace } from "@/components/budget/BudgetWorkspace";

export default function BudgetPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Budget</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        Requests, expenses, and invoices — both incoming (vendor bills) and outgoing (billing customers). Not a
        general ledger: this tracks requests and commercial documents, not the books.
      </p>
      <BudgetWorkspace />
    </main>
  );
}
