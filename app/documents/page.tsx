import { Page } from "@/components/ui/Page";
import { DocumentsWorkspace } from "@/components/documents/DocumentsWorkspace";

export default function DocumentsPage() {
  return (
    <Page
      title="Documents"
      description="Generate invitations, approval requests, confirmations, admission communications, and completion records — tied to a real lead or customer engagement, versioned, with an approval step before anything is marked sent. Proposals, quotations, and invoices live in Commercial Docs now."
    >
      <DocumentsWorkspace />
    </Page>
  );
}
