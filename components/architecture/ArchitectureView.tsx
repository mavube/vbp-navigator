"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Findings } from "@/components/Findings";
import { GdcChain } from "@/components/GdcChain";
import { GdcTable } from "@/components/GdcTable";
import { ServiceCatalogue } from "@/components/architecture/ServiceCatalogue";
import { ServiceGraph } from "@/components/architecture/ServiceGraph";
import type { ServiceRow } from "@/lib/db-services";

type Tab = "internal" | "gdc";

// v3.0 roadmap Phase 2 — replaces components/NavigatorApp.tsx (which
// rendered v1.0's entirely static, hardcoded JSX for VBP's own
// operation) with a live view over the real `services` table. The
// "Reference Case — GDC PMP" tab is deliberately left as-is: it's a
// fixed reference document (the canonical example VBP's own chain is
// measured against), not VBP's own live operational data, so there's
// nothing to make dynamic there — GdcChain/GdcTable are unchanged,
// still reading their own hardcoded reference content.
export function ArchitectureView() {
  const [tab, setTab] = useState<Tab>("internal");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("failed to load");
        return res.json();
      })
      .then((data) => {
        setServices(data);
        setError("");
      })
      .catch(() => setError("Couldn't load the service catalog — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-8)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", borderBottom: "1px solid var(--v2-border)" }}>
        {[
          { key: "internal" as Tab, label: "Internal Operation" },
          { key: "gdc" as Tab, label: "Reference Case — GDC PMP" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="v2-btn"
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--v2-accent)" : "2px solid transparent",
              borderRadius: 0,
              padding: "8px 4px",
              marginRight: "var(--v2-space-4)",
              color: tab === t.key ? "var(--v2-accent)" : "var(--v2-text-muted)",
              fontWeight: tab === t.key ? 600 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "internal" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-8)" }}>
          {loading && <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>}
          {error && <p style={{ color: "var(--v2-danger)" }}>{error}</p>}

          {!loading && !error && (
            <>
              <section>
                <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "var(--v2-text-xl)", fontWeight: 600, color: "var(--v2-text)", margin: "0 0 var(--v2-space-2)" }}>
                  The service chain
                </h2>
                <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-4)", maxWidth: 640 }}>
                  Computed live from each service&apos;s own dependency data — not a fixed diagram.
                  A dashed border marks a Customer Value Service with no provider assigned yet.
                </p>
                <ServiceGraph services={services} />
              </section>

              <section>
                <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "var(--v2-text-xl)", fontWeight: 600, color: "var(--v2-text)", margin: "0 0 var(--v2-space-2)" }}>
                  Services
                </h2>
                <p style={{ color: "var(--v2-text-muted)", marginBottom: "var(--v2-space-4)", maxWidth: 640 }}>
                  Full detail per service, straight from the catalog — grouped by CVS/Enabling, or by
                  who actually provides them.
                </p>
                <ServiceCatalogue services={services} />
              </section>

              <Card>
                <Findings />
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "gdc" && (
        <div className="sheet" style={{ maxWidth: "none", margin: 0 }}>
          <div className="section">
            <h2 className="section-title">The service chain</h2>
            <p className="section-lede">
              The corrected reference model — this is the shape VBP&apos;s own internal chain
              (previous tab) is measured against.
            </p>
            <div className="diagram-legend">
              <span className="lg-item"><span className="swatch cvs" />Customer Value Service</span>
              <span className="lg-item"><span className="swatch enabling" />Enabling Service</span>
            </div>
            <figure>
              <div className="diagram-scroll">
                <GdcChain />
              </div>
              <figcaption>
                Five Customer Value Services, not one. Do not collapse &quot;Professional
                Readiness Assessment,&quot; &quot;Candidate Admission,&quot; &quot;Master Class
                Delivery,&quot; &quot;Post-Training Certification Support&quot; and
                &quot;Certification / Completion Fulfillment&quot; into a single catch-all — each
                has its own provider, recipient and outcome.
              </figcaption>
            </figure>
          </div>

          <div className="section">
            <h2 className="section-title">Department → service, with type</h2>
            <GdcTable />
            <p className="section-lede" style={{ marginTop: 10 }}>
              Professional Readiness Assessment isn&apos;t tied to a single department in the
              source information — it&apos;s still drawn as its own Customer Value Service in the
              chain above rather than folded into Admissions or Instructor.
            </p>
            <p className="section-lede">
              GDC also runs Customer Value Services outside the PMP journey — Business
              Transformation &amp; ICT Systems Advisory, Project Management &amp; Implementation
              Advisory, Business Process &amp; Value Advisory. Distinct services in their own
              right; not Blueprinted here, since this reference case covers the PMP journey only.
            </p>
          </div>

          <div className="section">
            <h2 className="section-title">What it catches that the department view misses</h2>
            <div className="callout">
              <strong>Late onboarding.</strong> Instructor, venue, simulator and marketing all
              excellent — but candidates get onboarding info late. Admissions says &quot;registration
              was completed.&quot; The service question is different: did the Candidate Admission
              Service actually prepare the candidate? If not, it&apos;s a service failure, not
              &quot;an email problem.&quot;
            </div>
            <div className="callout">
              <strong>Payment vs. enrollment.</strong> Finance hasn&apos;t confirmed some
              payments; Training doesn&apos;t know who&apos;s fully enrolled; candidates get
              conflicting information. Finance: &quot;we did our part.&quot; Training: &quot;we
              never received it.&quot; Both true — the real fault is a broken dependency: Payment
              Confirmation → Candidate Admission → Onboarding.
            </div>
          </div>

          <p className="pull-quote">
            GDC doesn&apos;t have a Marketing, Finance, Administration and Training department
            that happen to work on a PMP Master Class. GDC has multiple service providers whose
            services must work together to deliver one PMP Professional Readiness journey.
          </p>
        </div>
      )}
    </div>
  );
}
