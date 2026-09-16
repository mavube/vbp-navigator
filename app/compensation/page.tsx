import { Page } from "@/components/ui/Page";
import { CompensationBoard } from "@/components/compensation/CompensationBoard";

export default function CompensationPage() {
  return (
    <Page
      title="Compensation"
      description="The Compensation Earning Service — real payroll computation (Basic Pay + Allowances − Deductions = Net Pay), not a category on Expense. Jennifer creates draft entries; Anne finalizes them, which also generates the linked Expense against this service."
    >
      <CompensationBoard />
    </Page>
  );
}
