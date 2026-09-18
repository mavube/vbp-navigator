"use client";

import type { CSSProperties } from "react";
import { Card } from "@/components/ui/Card";
import type { ServiceOption, ServiceRollup, FiscalYearTotals } from "@/components/capabilities/types";

function Stat({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", marginRight: "var(--v2-space-3)" }}>
      {label}: <strong style={{ color: "var(--v2-text)" }}>{value.toLocaleString()}</strong>
    </span>
  );
}

function fyButtonStyle(active: boolean): CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: "0.75rem",
    ...(active ? { borderColor: "var(--v2-accent)", color: "var(--v2-accent)" } : {}),
  };
}

// Org-wide comparison across the three adjacent fiscal years — v3.0
// roadmap Phase 3. FY = calendar year here (confirmed 2026-09-16), so
// these are plain year labels, not a July-June split. Also doubles as
// the selector that scopes the per-service stats below to one year (or
// back to all-time). "Next FY" usually reads all-zero until real
// forward spend/payroll exists — shown rather than hidden, since an
// honest "nothing yet" beats a row that silently isn't there.
function FiscalYearComparison({
  fiscalYears,
  selected,
  onSelect,
}: {
  fiscalYears: FiscalYearTotals[];
  selected: number | undefined;
  onSelect: (fy: number | undefined) => void;
}) {
  if (fiscalYears.length === 0) return null;
  return (
    <Card style={{ padding: "var(--v2-space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--v2-space-2)",
          marginBottom: "var(--v2-space-3)",
        }}
      >
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: 0 }}>Financial year comparison</h2>
        <div style={{ display: "flex", gap: "6px" }}>
          <button type="button" onClick={() => onSelect(undefined)} className="v2-btn v2-btn-secondary" style={fyButtonStyle(selected === undefined)}>
            All time
          </button>
          {fiscalYears.map((fy) => (
            <button
              key={fy.fiscalYear}
              type="button"
              onClick={() => onSelect(fy.fiscalYear)}
              className="v2-btn v2-btn-secondary"
              style={fyButtonStyle(selected === fy.fiscalYear)}
            >
              {fy.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--v2-space-3)" }}>
        {fiscalYears.map((fy) => (
          <div
            key={fy.fiscalYear}
            style={{ padding: "var(--v2-space-3)", background: "var(--v2-surface-sunken)", borderRadius: "var(--v2-radius-sm)" }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--v2-text-muted)", marginBottom: "6px" }}>
              {fy.label}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text)" }}>
              Budget approved: <strong>{fy.budgetApprovedTotal.toLocaleString()}</strong>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text)" }}>
              Expenses: <strong>{fy.expensesTotal.toLocaleString()}</strong>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text)" }}>
              Net pay: <strong>{fy.compensationNetPayTotal.toLocaleString()}</strong>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Each service's outcome, paired with real computed numbers instead of
// just the static sentence — per the alignment doc Section 5 ("Outcomes
// — Measured outcomes, not just described"). v3.0 Phase 3 adds the FY
// comparison card above and scopes the two financial stats (Budget
// approved, Expenses) — plus Net pay disbursed — to whichever year is
// selected there.
export function OutcomesView({
  services,
  rollups,
  fiscalYears,
  fiscalYear,
  onFiscalYearChange,
}: {
  services: ServiceOption[];
  rollups: ServiceRollup[];
  fiscalYears: FiscalYearTotals[];
  fiscalYear: number | undefined;
  onFiscalYearChange: (fy: number | undefined) => void;
}) {
  const rollupFor = (serviceId: string) => rollups.find((r) => r.serviceId === serviceId);
  const scopeSuffix = fiscalYear ? ` (${fiscalYear})` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-4)" }}>
      <FiscalYearComparison fiscalYears={fiscalYears} selected={fiscalYear} onSelect={onFiscalYearChange} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
        {services.map((s) => {
          const r = rollupFor(s.id);
          return (
            <Card key={s.id} style={{ padding: "var(--v2-space-4)" }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              {s.outcome && (
                <p style={{ fontSize: "0.85rem", color: "var(--v2-text-muted)", margin: "4px 0 var(--v2-space-2)" }}>
                  {s.outcome}
                </p>
              )}
              <div>
                <Stat label="Tasks done" value={r?.tasksDone ?? 0} />
                <Stat label="Requests resolved" value={r?.requestsResolved ?? 0} />
                <Stat label="Leads won" value={r?.leadsWon ?? 0} />
                <Stat label="Classes completed" value={r?.classesCompleted ?? 0} />
                <Stat label={`Budget approved${scopeSuffix}`} value={r?.budgetApprovedAmount ?? 0} />
                <Stat label={`Expenses${scopeSuffix}`} value={r?.expensesTotal ?? 0} />
                <Stat label="Compensation finalized" value={r?.compensationFinalizedCount ?? 0} />
                <Stat label={`Net pay disbursed${scopeSuffix}`} value={r?.compensationNetPayTotal ?? 0} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
