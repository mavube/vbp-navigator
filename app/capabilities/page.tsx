import { CapabilitiesWorkspace } from "@/components/capabilities/CapabilitiesWorkspace";

export default function CapabilitiesPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Capabilities</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        Workload — what&apos;s active right now, by service and by person — and Outcomes — what each service has
        actually delivered, computed live from tasks, requests, leads, classes, budget, and compensation data.
      </p>
      <CapabilitiesWorkspace />
    </main>
  );
}
