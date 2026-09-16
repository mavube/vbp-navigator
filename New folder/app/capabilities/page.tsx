import { Page } from "@/components/ui/Page";
import { CapabilitiesWorkspace } from "@/components/capabilities/CapabilitiesWorkspace";

export default function CapabilitiesPage() {
  return (
    <Page
      title="Capabilities"
      description="Workload — what's active right now, by service and by person — and Outcomes — what each service has actually delivered, computed live from tasks, requests, leads, classes, budget, and compensation data."
    >
      <CapabilitiesWorkspace />
    </Page>
  );
}
