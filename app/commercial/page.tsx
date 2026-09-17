import { Page } from "@/components/ui/Page";
import { CommercialDocsWorkspace } from "@/components/commercial/CommercialDocsWorkspace";

export default function CommercialDocsPage() {
  return (
    <Page
      title="Commercial Docs"
      description="Proposals, quotations, and invoices — money-bearing, chainable (convert one into the next, inheriting its details), and startable at any point: a phone or email order can go straight to Invoice with no prior document."
    >
      <CommercialDocsWorkspace />
    </Page>
  );
}
