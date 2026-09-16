"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface OrgKpiSummary {
  fiscalYear: number | undefined;
  activeWork: number;
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
  costTotal: number;
  netTotal: number;
  servicesHealthy: number;
  servicesAttention: number;
  servicesAtRisk: number;
  blockersHighImpactOpen: number;
  tasksOverdue: number;
  atRiskServices: Array<{ serviceId: string; serviceName: string; status: string; reasons: string[] }>;
}

interface FiscalYearTotals {
  fiscalYear: number;
  label: string;
  budgetApprovedTotal: number;
  expensesTotal: number;
  compensationNetPayTotal: number;
  revenueOutgoingTotal: number;
  revenueCollectedTotal: number;
}

function fyButtonStyle(active: boolean): CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: "0.75rem",
    ...(active ? { borderColor: "var(--v2-accent)", color: "var(--v2-accent)" } : {}),
  };
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)", marginBottom: "6px" }}>{label}</div>
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: tone === "success" ? "var(--v2-success)" : tone === "danger" ? "var(--v2-danger)" : "var(--v2-text)",
        }}
      >
        {value}
      </div>
    </Card>
  );
}

// v3.0 roadmap Phase 7 — the "real KPI Dashboard" (§15-16, §18, §25)
// the roadmap names as this phase's direct answer to "no dashboard for
// real work KPIs." Everything here is a fold-down of numbers that
// already exist elsewhere (Capabilities' rollups, Service Health,
// Budget/Compensation/Documents' invoices) — this page's only job is
// showing the org-wide shape of that data at a glance, not computing
// anything new. See lib/rollups.ts's getOrgKpiSummary.
export function DashboardView() {
  const [summary, setSummary] = useState<OrgKpiSummary | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearTotals[]>([]);
  const [currentFy, setCurrentFy] = useState<number | null>(null);
  // undefined = all-time, matching Capabilities' Outcomes tab. Scopes
  // revenue/cost/net only — activeWork, health, blockers, and overdue
  // tasks are inherently "right now" signals and stay all-time
  // regardless, same split lib/rollups.ts already documents.
  const [fiscalYear, setFiscalYear] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const url = fiscalYear ? `/api/dashboard?fy=${fiscalYear}` : "/api/dashboard";
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setSummary(data.summary);
        setFiscalYears(data.fiscalYears);
        setCurrentFy(data.currentFiscalYear);
        setError("");
      })
      .catch(() => setError("Couldn't load dashboard data — try refreshing."))
      .finally(() => setLoading(false));
  }, [fiscalYear]);

  if (loading && !summary) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;
  if (!summary) return null;

  const scopeSuffix = fiscalYear ? ` (${fiscalYear})` : " (all time)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Card style={{ padding: "var(--v2-space-4)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
          <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: 0 }}>Revenue &amp; cost{scopeSuffix}</h2>
          <div style={{ display: "flex", gap: "6px" }}>
            <button type="button" onClick={() => setFiscalYear(undefined)} className="v2-btn v2-btn-secondary" style={fyButtonStyle(fiscalYear === undefined)}>
              All time
            </button>
            {fiscalYears.map((fy) => (
              <button
                key={fy.fiscalYear}
                type="button"
                onClick={() => setFiscalYear(fy.fiscalYear)}
                className="v2-btn v2-btn-secondary"
                style={fyButtonStyle(fiscalYear === fy.fiscalYear)}
              >
                {fy.label}
                {currentFy === fy.fiscalYear ? " •" : ""}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--v2-space-3)" }}>
        <KpiCard label="Active work items" value={summary.activeWork.toLocaleString()} />
        <KpiCard label="Revenue invoiced" value={summary.revenueOutgoingTotal.toLocaleString()} />
        <KpiCard label="Revenue collected" value={summary.revenueCollectedTotal.toLocaleString()} />
        <KpiCard label="Cost (expenses + payroll)" value={summary.costTotal.toLocaleString()} />
        <KpiCard
          label="Net (collected − cost)"
          value={summary.netTotal.toLocaleString()}
          tone={summary.netTotal >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Overdue tasks"
          value={summary.tasksOverdue.toLocaleString()}
          tone={summary.tasksOverdue > 0 ? "danger" : undefined}
        />
      </div>

      <Card style={{ padding: "var(--v2-space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--v2-space-2)" }}>
          <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: 0 }}>Service health</h2>
          <Link href="/capabilities" style={{ fontSize: "0.8rem", color: "var(--v2-accent)" }}>
            Full breakdown →
          </Link>
        </div>
        <div style={{ display: "flex", gap: "var(--v2-space-6)", marginTop: "var(--v2-space-3)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{summary.servicesAtRisk}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)" }}>At risk</div>
          </div>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{summary.servicesAttention}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)" }}>Need attention</div>
          </div>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{summary.servicesHealthy}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)" }}>Healthy</div>
          </div>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{summary.blockersHighImpactOpen}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)" }}>Critical/high blockers open</div>
          </div>
        </div>

        {summary.atRiskServices.length > 0 && (
          <div style={{ marginTop: "var(--v2-space-4)", display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
            {summary.atRiskServices.map((s) => (
              <div
                key={s.serviceId}
                style={{
                  padding: "var(--v2-space-3)",
                  background: "var(--v2-surface-sunken)",
                  borderRadius: "var(--v2-radius-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: "var(--v2-space-2)",
                }}
              >
                <div>
                  <strong>{s.serviceName}</strong>
                  {s.reasons.length > 0 && (
                    <span style={{ fontSize: "0.78rem", color: "var(--v2-text-muted)" }}> — {s.reasons.join("; ")}</span>
                  )}
                </div>
                <Badge tone="danger">At risk</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ padding: "var(--v2-space-4)" }}>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Financial year trend
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--v2-space-3)" }}>
          {fiscalYears.map((fy) => (
            <div
              key={fy.fiscalYear}
              style={{ padding: "var(--v2-space-3)", background: "var(--v2-surface-sunken)", borderRadius: "var(--v2-radius-sm)" }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--v2-text-muted)", marginBottom: "6px" }}>
                {fy.label}
                {currentFy === fy.fiscalYear ? " (current)" : ""}
              </div>
              <div style={{ fontSize: "0.8rem" }}>Revenue collected: <strong>{fy.revenueCollectedTotal.toLocaleString()}</strong></div>
              <div style={{ fontSize: "0.8rem" }}>Expenses: <strong>{fy.expensesTotal.toLocaleString()}</strong></div>
              <div style={{ fontSize: "0.8rem" }}>Net pay: <strong>{fy.compensationNetPayTotal.toLocaleString()}</strong></div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", marginTop: "var(--v2-space-3)" }}>
          &quot;Next FY&quot; reads all-zero until real forward spend, payroll, or invoicing exists for it — shown rather than
          hidden, same as Capabilities&apos; Outcomes tab.
        </p>
      </Card>
    </div>
  );
}
