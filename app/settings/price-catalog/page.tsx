import { Page } from "@/components/ui/Page";
import { PriceCatalogManager } from "@/components/settings/PriceCatalogManager";

export default function PriceCatalogPage() {
  return (
    <Page
      title="Products & Services Catalog"
      description="What GDC actually offers — the real portfolio, not just PMP. Each item carries an offering definition (category, target customer, delivery model, outcome) plus the tax-exclusive price staff select when building a Proposal, Quotation, or Invoice. Org Admin only."
    >
      <PriceCatalogManager />
    </Page>
  );
}
