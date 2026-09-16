import { RequestBoard } from "@/components/service-requests/RequestBoard";

export default function ServiceRequestsPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Service Requests</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        ITSM-style requests and incidents, each tied to the service they're against — no undifferentiated helpdesk
        queue.
      </p>
      <RequestBoard />
    </main>
  );
}
