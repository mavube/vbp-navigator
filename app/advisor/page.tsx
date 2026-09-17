import { Page } from "@/components/ui/Page";
import { AdvisorView } from "@/components/advisor/AdvisorView";

export default function AdvisorPage() {
  return (
    <Page
      title="Advisor"
      description="The AI Operating Layer's first stage: Observe, Understand, Advise. Reads a live snapshot of your org's own services, work, blockers, pipeline, and finances and surfaces what's actually happening, how it connects, and what to do about it — nothing is drafted or sent automatically."
    >
      <AdvisorView />
    </Page>
  );
}
