import { Page } from "@/components/ui/Page";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <Page
      title="Dashboard"
      description="Real work KPIs, computed live — active work, revenue, cost, net, service health, and open blockers, org-wide. See Capabilities for the per-service and per-person breakdown this rolls up."
    >
      <DashboardView />
    </Page>
  );
}
