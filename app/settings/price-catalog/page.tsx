import { Page } from "@/components/ui/Page";
import { PriceCatalogManager } from "@/components/settings/PriceCatalogManager";

export default function PriceCatalogPage() {
  return (
    <Page
      title="Price Catalog"
      description="Predefined, tax-exclusive prices staff select from when building a Proposal, Quotation, or Invoice — instead of typing a line item by hand. Org Admin only."
    >
      <PriceCatalogManager />
    </Page>
  );
}
