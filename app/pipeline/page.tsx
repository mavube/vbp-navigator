import { Page } from "@/components/ui/Page";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelinePage() {
  return (
    <Page
      title="Pipeline"
      description="Leads moving through your sales process, from first contact to won or lost — for any service or product in your portfolio, not just one."
    >
      <PipelineBoard />
    </Page>
  );
}
