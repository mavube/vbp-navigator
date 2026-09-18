import { Suspense } from "react";
import { Page } from "@/components/ui/Page";
import { CustomersWorkspace } from "@/components/customers/CustomersWorkspace";

export default function CustomersPage() {
  return (
    <Page
      title="Customers"
      description="Real customer relationships, each holding one or more Engagements — a customer's actual journey through a specific service, created automatically the moment a lead is won."
    >
      {/* CustomersWorkspace reads ?highlight= via useSearchParams (the
          Pipeline admission deep-link) — Next.js requires a Suspense
          boundary around any component that calls useSearchParams so
          this page can still be statically prerendered. */}
      <Suspense fallback={<p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>}>
        <CustomersWorkspace />
      </Suspense>
    </Page>
  );
}
