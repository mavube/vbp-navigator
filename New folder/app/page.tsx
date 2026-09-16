import { Page } from "@/components/ui/Page";
import { ArchitectureView } from "@/components/architecture/ArchitectureView";

export default function HomePage() {
  return (
    <Page
      title="VBP Navigator"
      description="The Service & Value Architecture behind VBP's own operation — who provides what, who depends on it, and where the chain is exposed. Built on the ValueBlueprint® method. Computed live from the org's own service catalog, not a fixed diagram."
    >
      <ArchitectureView />
    </Page>
  );
}
