import { Page } from "@/components/ui/Page";
import { ProspectsWorkspace } from "@/components/prospects/ProspectsWorkspace";

export default function ProspectsPage() {
  return (
    <Page
      title="Prospects"
      description="Everyone who came in through the public application or readiness assessment forms — review each one and promote it into the Pipeline, or decline it."
    >
      <ProspectsWorkspace />
    </Page>
  );
}
