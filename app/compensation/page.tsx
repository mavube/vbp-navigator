import { CompensationBoard } from "@/components/compensation/CompensationBoard";

export default function CompensationPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Compensation</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        The Compensation Earning Service — real payroll computation (Basic Pay + Allowances − Deductions = Net
        Pay), not a category on Expense. Jennifer creates draft entries; Anne finalizes them, which also generates
        the linked Expense against this service.
      </p>
      <CompensationBoard />
    </main>
  );
}
