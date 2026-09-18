import { Page } from "@/components/ui/Page";
import { CustomerDetail } from "@/components/customers/CustomerDetail";

// Phase E (Customer Workspace rebuild) — the per-customer detail route
// that didn't exist before this phase (CustomersWorkspace.tsx's own
// comment used to say so directly). See CustomerDetail.tsx for what it
// assembles and why.
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page title="Customer">
      <CustomerDetail customerId={id} />
    </Page>
  );
}
