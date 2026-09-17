"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface AiInsights {
  observations: string;
  connections: string[];
  recommendations: string[];
  generatedAt: string;
  raw?: string;
}

// v3.0 roadmap Phase 8 — AI Operating Layer (§19), Observe/Understand/
// Advise stage. Deliberately no auto-fetch on mount: each "Generate
// insights" click is a real, billed Claude API call, so it only ever
// happens when someone in the org explicitly asks for it — same
// "don't spend the org's money without them asking" instinct as the
// rest of this app's no-auto-anything design.
export function AdvisorView() {
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    setNotConfigured(false);
    try {
      const res = await fetch("/api/ai/observe", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Couldn't generate insights — try again.");
        return;
      }
      setInsights(data);
    } catch {
      setError("Couldn't reach the AI service — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <Card style={{ padding: "var(--v2-space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--v2-space-3)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{insights ? "Regenerate" : "Generate insights"}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)" }}>
              Reads a live snapshot of your org's services, work, blockers, pipeline, finances, budget/compensation
              exposure, task velocity, pipeline and prospect aging, class enrollment, document/request
              backlog age, how those numbers have moved since the snapshot last captured, and decisions/lessons
              logged in Memory — nothing else's.
              {insights && ` Last generated ${new Date(insights.generatedAt).toLocaleString()}.`}
            </div>
          </div>
          <Button onClick={generate} loading={loading}>
            {loading ? "Thinking…" : insights ? "Regenerate" : "Generate insights"}
          </Button>
        </div>
      </Card>

      {notConfigured && (
        <Card style={{ padding: "var(--v2-space-4)" }}>
          <Badge tone="warning">Not configured</Badge>
          <p style={{ marginTop: "var(--v2-space-2)", color: "var(--v2-text-muted)" }}>
            The AI Operating Layer needs an <code>ANTHROPIC_API_KEY</code> set as an environment variable before it can
            run. If you just added one in Vercel, redeploy and try again.
          </p>
        </Card>
      )}

      {error && (
        <Card style={{ padding: "var(--v2-space-4)" }}>
          <p style={{ color: "var(--v2-danger)" }}>{error}</p>
        </Card>
      )}

      {insights && !insights.raw && (
        <>
          <Card style={{ padding: "var(--v2-space-4)" }}>
            <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-2)" }}>Observations</h2>
            <p style={{ color: "var(--v2-text)", margin: 0 }}>{insights.observations || "Nothing notable right now."}</p>
          </Card>

          <Card style={{ padding: "var(--v2-space-4)" }}>
            <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-2)" }}>Connections</h2>
            {insights.connections.length === 0 ? (
              <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>Nothing worth connecting right now.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
                {insights.connections.map((c, i) => (
                  <li key={i} style={{ color: "var(--v2-text)" }}>{c}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card style={{ padding: "var(--v2-space-4)" }}>
            <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-2)" }}>Recommendations</h2>
            {insights.recommendations.length === 0 ? (
              <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>Nothing to recommend right now.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
                {insights.recommendations.map((r, i) => (
                  <li key={i} style={{ color: "var(--v2-text)" }}>{r}</li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}

      {insights?.raw && (
        <Card style={{ padding: "var(--v2-space-4)" }}>
          <Badge tone="warning">Unstructured response</Badge>
          <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", margin: "var(--v2-space-2) 0" }}>
            The AI service responded but not in the expected format — showing it as-is rather than discarding it.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", background: "var(--v2-surface-sunken)", padding: "var(--v2-space-3)", borderRadius: "var(--v2-radius-sm)", margin: 0 }}>
            {insights.raw}
          </pre>
        </Card>
      )}
    </div>
  );
}
