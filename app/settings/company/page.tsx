import { Page } from "@/components/ui/Page";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";

export default function CompanySettingsPage() {
  return (
    <Page
      title="Company Settings"
      description="The legal, banking, and sending identity used on every generated Proposal, Quotation, and Invoice — edit it here instead of a developer editing code. Org Admin only."
    >
      <CompanySettingsForm />
    </Page>
  );
}
