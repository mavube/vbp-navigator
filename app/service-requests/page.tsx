import { Page } from "@/components/ui/Page";
import { RequestBoard } from "@/components/service-requests/RequestBoard";

export default function ServiceRequestsPage() {
  return (
    <Page
      title="Service Requests"
      description="ITSM-style requests and incidents, each tied to the service they're against — no undifferentiated helpdesk queue."
    >
      <RequestBoard />
    </Page>
  );
}
