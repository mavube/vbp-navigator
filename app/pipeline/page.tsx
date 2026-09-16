import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelinePage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--v2-space-8) var(--v2-space-4)" }}>
      <h1 style={{ fontFamily: "var(--v2-font)", fontSize: "1.75rem", marginBottom: "4px" }}>Pipeline</h1>
      <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-6)" }}>
        Candidates moving through Readiness Assessment and Admission — the two services this gives a
        de facto owner to.
      </p>
      <PipelineBoard />
    </main>
  );
}
