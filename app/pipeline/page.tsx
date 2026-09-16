import { Page } from "@/components/ui/Page";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelinePage() {
  return (
    <Page
      title="Pipeline"
      description="Candidates moving through Readiness Assessment and Admission — the two services this gives a de facto owner to."
    >
      <PipelineBoard />
    </Page>
  );
}
