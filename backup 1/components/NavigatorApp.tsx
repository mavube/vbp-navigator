"use client";

import { useState } from "react";
import { InternalChain } from "./InternalChain";
import { GdcChain } from "./GdcChain";
import { ServiceCardsByService, ProviderTable } from "./ServiceCards";
import { GdcTable } from "./GdcTable";
import { Findings } from "./Findings";

type Tab = "internal" | "gdc";
type View = "by-service" | "by-provider";

export function NavigatorApp() {
  const [tab, setTab] = useState<Tab>("internal");
  const [view, setView] = useState<View>("by-service");

  return (
    <div className="sheet">
      <header className="titleblock">
        <h1>VBP Navigator</h1>
        <p className="sub">
          The Service &amp; Value Architecture behind VBP&apos;s own operation — who provides
          what, who depends on it, and where the chain is exposed. Built on the ValueBlueprint®
          method.
        </p>
        <div className="metabar">
          <dl><dt>Doc</dt><dd>VBP&#8209;SVA&#8209;01</dd></dl>
          <dl><dt>Method</dt><dd>ValueBlueprint®</dd></dl>
          <dl><dt>Status</dt><dd>Living</dd></dl>
          <dl><dt>Scope</dt><dd>Internal ops + reference case</dd></dl>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="View">
        <button
          className="tab"
          role="tab"
          aria-selected={tab === "internal"}
          onClick={() => setTab("internal")}
        >
          Internal Operation
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={tab === "gdc"}
          onClick={() => setTab("gdc")}
        >
          Reference Case — GDC PMP
        </button>
      </div>

      {tab === "internal" && (
        <section className="panel is-active" role="tabpanel">
          <div className="value-statement">
            <span className="label">Value — not a service</span>
            <p>
              VBP&apos;s promise to a client: <strong>arrive ready, leave certified.</strong> That
              promise is carried by five distinct Customer Value Services below — not one
              catch-all &quot;training service,&quot; and not a list of departments. Departments
              still exist; they&apos;re shown as context on each service, not as the unit of
              analysis.
            </p>
          </div>

          <div className="section">
            <h2 className="section-title">The service chain</h2>
            <p className="section-lede">
              The customer value chain stays visually dominant — enabling services attach to it
              as dependencies, not as a second parallel chain. Two Customer Value Services below
              are drawn as gaps: real stages in the journey with no clear provider yet.
            </p>

            <div className="diagram-legend">
              <span className="lg-item"><span className="swatch cvs" />Customer Value Service</span>
              <span className="lg-item"><span className="swatch gap" />CVS — no clear owner</span>
              <span className="lg-item"><span className="swatch enabling" />Enabling Service</span>
            </div>

            <figure>
              <div className="diagram-scroll">
                <InternalChain />
              </div>
              <figcaption>
                &quot;Department&quot; now rides along as a small tag on each service instead of
                a whole second row — it&apos;s context, not the thing being analyzed. Two
                Customer Value Services are drawn as gaps because no one is evidenced as owning
                them yet.
              </figcaption>
            </figure>
          </div>

          <div className="section">
            <h2 className="section-title">Services</h2>
            <p className="section-lede">
              Fewer, clearer services — full detail per service, and an alternate view grouped by
              who actually provides them.
            </p>

            <div className="view-toggle" role="group" aria-label="Group services by">
              <button type="button" aria-pressed={view === "by-service"} onClick={() => setView("by-service")}>
                By service
              </button>
              <button type="button" aria-pressed={view === "by-provider"} onClick={() => setView("by-provider")}>
                By provider
              </button>
            </div>

            <div className={`view-block ${view === "by-service" ? "is-active" : ""}`}>
              <ServiceCardsByService />
            </div>
            <div className={`view-block ${view === "by-provider" ? "is-active" : ""}`}>
              <ProviderTable />
            </div>
          </div>

          <Findings />
        </section>
      )}

      {tab === "gdc" && (
        <section className="panel is-active" role="tabpanel">
          <div className="value-statement">
            <span className="label">Reference pattern</span>
            <p>
              GDC&apos;s next PMP Master Class. Not &quot;what does each department do&quot; —{" "}
              <strong>what services does GDC actually provide?</strong> Five distinct Customer
              Value Services carry a candidate from &quot;I want to become PMP certified&quot; to
              &quot;I am certified&quot; — not one catch-all readiness service.
            </p>
          </div>

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
        </section>
      )}

      <footer>
        <span>VBP Navigator OS · ValueBlueprint® method</span>
        <span>Findings sync for everyone with this page open</span>
      </footer>
    </div>
  );
}
