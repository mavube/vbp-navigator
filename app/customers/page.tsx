import { Page } from "@/components/ui/Page";
import { CustomersWorkspace } from "@/components/customers/CustomersWorkspace";

export default function CustomersPage() {
  return (
    <Page
      title="Customers"
      description="Real customer relationships, each holding one or more Engagements — a customer's actual journey through a specific service, created automatically the moment a lead is won. Open a customer for their full workspace."
    >
      <CustomersWorkspace />
    </Page>
  );
}
