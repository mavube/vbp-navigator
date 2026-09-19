"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessment-questions";
import { DISCOVERY_QUESTIONS, CATEGORY_ADAPTIVE_QUESTION } from "@/lib/discovery-questions";
import { PMP_ELIGIBILITY_QUESTIONS, checkPmpEligibility, isPmpProduct } from "@/lib/pmp-eligibility";

interface PublicService {
  id: string;
  name: string;
  description: string;
  customerNeed: string;
}

interface PublicProduct {
  id: string;
  name: string;
  category: string;
  offeringType: string;
  description: string;
}

// /start warm-lead-intelligence plan, Phase 1 (intake backbone) —
// replaces the old binary Training/Consulting track with a real,
// catalog-driven entry: one button per business-line `category`
// actually present in the catalog (the same five real values Products
// & Services Catalog already suggests — CATEGORY_SUGGESTIONS in
// components/settings/PriceCatalogManager.tsx), Certification pulled
// out as its own button regardless of category (any item with
// offeringType "Certification Program"), and "I'm not sure" for a
// visitor who doesn't know which of those they need. Order is fixed
// for a familiar menu; anything outside this list (a future sixth
// business line) still shows, just appended alphabetically rather than
// silently dropped — the catalog stays the one source of truth for
// what appears here, never a second hardcoded list.
type EntryChoice = { kind: "category"; category: string } | { kind: "certification" } | { kind: "not_sure" };

const CATEGORY_ORDER = [
  "Training & Capability Development",
  "Project Management & Implementation Advisory",
  "Business Process & Value Advisory",
  "Business Transformation & ICT Advisory",
  "Technology & Digital Solutions",
];

function orderedCategories(products: PublicProduct[]): string[] {
  const present = new Set(products.map((p) => p.category).filter((c): c is string => !!c));
  const known = CATEGORY_ORDER.filter((c) => present.has(c));
  const extra = Array.from(present).filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  return [...known, ...extra];
}

// Real catalog item names as the entry screen's own description text —
// deliberately not hand-written per-category copy, which would just be
// a second thing to keep in sync with whatever Diallo actually adds to
// the catalog. Empty string (no description shown) if a category
// somehow has no items, which orderedCategories already prevents.
function sampleNames(items: PublicProduct[]): string {
  const names = items.map((p) => p.name);
  if (names.length === 0) return "";
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ", …" : "");
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void; "expired-callback"?: () => void }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function StartForm({ orgSlug }: { orgSlug: string }) {
  const [services, setServices] = useState<PublicService[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [orgName, setOrgName] = useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Catalog present -> the real entry menu below. Catalog empty ->
  // falls back to one plain quick-inquiry form against the internal
  // service list, same "never go blank" behavior the old /apply had —
  // there's no category/offeringType to route on until Diallo enters
  // real catalog items. Phase 1 doesn't touch this fallback path.
  const usingProductPicker = products.length > 0;

  const [entry, setEntry] = useState<EntryChoice | null>(null);
  const [stage, setStage] = useState<"entry" | "form">("entry");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [productServiceId, setProductServiceId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileRenderedRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/public/org/${orgSlug}/services`, { cache: "no-store" }).then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("failed");
        return res.json();
      }),
      fetch(`/api/public/org/${orgSlug}/products`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { products: [] }))
        .catch(() => ({ products: [] })),
    ])
      .then(([serviceData, productData]) => {
        if (!serviceData) return;
        setOrgName(serviceData.orgName);
        setServices(serviceData.services);
        setTurnstileSiteKey(serviceData.turnstileSiteKey || "");
        const prods: PublicProduct[] = productData.products ?? [];
        setProducts(prods);
        if (prods.length === 0) {
          // No catalog yet — skip the entry menu entirely, same
          // single-form behavior the old /apply had.
          setStage("form");
          if (serviceData.services.length === 1) setServiceId(serviceData.services[0].id);
        }
      })
      .catch(() => setLoadError("Couldn't load this page right now — try again shortly."))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  // Load the Turnstile script once (skipped entirely if this org
  // hasn't configured a site key), then render the widget into its
  // container once we're actually on the form stage.
  useEffect(() => {
    if (!turnstileSiteKey || stage !== "form" || turnstileRenderedRef.current) return;

    function renderWidget() {
      if (!turnstileContainerRef.current || !window.turnstile || turnstileRenderedRef.current) return;
      window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        "error-callback": () => setTurnstileToken(""),
        "expired-callback": () => setTurnstileToken(""),
      });
      turnstileRenderedRef.current = true;
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }
    let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderWidget);
    return () => script?.removeEventListener("load", renderWidget);
  }, [turnstileSiteKey, stage]);

  function chooseEntry(choice: EntryChoice) {
    setEntry(choice);
    setStage("form");
  }

  function backToEntry() {
    setStage("entry");
    setEntry(null);
    setProductServiceId("");
    setAnswers({});
  }

  const certProducts = products.filter((p) => p.offeringType === "Certification Program");
  const nonCertProducts = products.filter((p) => p.offeringType !== "Certification Program");

  const entryProducts =
    entry?.kind === "category"
      ? nonCertProducts.filter((p) => p.category === entry.category)
      : entry?.kind === "certification"
        ? certProducts
        : products; // "not sure" (or no entry chosen yet) — show everything

  const selectedProduct = products.find((p) => p.id === productServiceId);
  const showAssessment = usingProductPicker && selectedProduct?.offeringType === "Certification Program";
  const isGeneralDiscovery = usingProductPicker && !!selectedProduct && !showAssessment;
  const adaptiveQuestion = isGeneralDiscovery && selectedProduct ? CATEGORY_ADAPTIVE_QUESTION[selectedProduct.category] : undefined;
  // Phase 2 — PMP eligibility, facts only. A Certification item whose
  // catalog name mentions PMP gets PMI's real four-input eligibility
  // questions instead of the generic assessment questions (see
  // lib/pmp-eligibility.ts's header comment for why this is a
  // name-based signal rather than a new catalog field). Any other
  // Certification item — none exist in GDC's catalog today, but the
  // app stays catalog-driven rather than PMP-only — still gets the
  // original generic questions.
  const isPmpEligibility = showAssessment && !!selectedProduct && isPmpProduct(selectedProduct.name);
  const assessmentQuestions = isPmpEligibility ? PMP_ELIGIBILITY_QUESTIONS : ASSESSMENT_QUESTIONS;
  const pmpFacts = isPmpEligibility ? checkPmpEligibility(answers) : null;

  function entryTitle(): string {
    if (!usingProductPicker) return orgName ? `Get started with ${orgName}` : "Get started";
    if (!entry) return orgName ? `Get started with ${orgName}` : "Get started";
    if (entry.kind === "certification") return "Certification & Professional Readiness";
    if (entry.kind === "not_sure") return "Tell us what you're trying to do";
    return entry.category;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("Your name is required.");
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the verification check below before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const capturesStructuredAnswers = showAssessment || isGeneralDiscovery;
      const res = await fetch(`/api/public/org/${orgSlug}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          serviceId: serviceId || undefined,
          productServiceId: productServiceId || undefined,
          source: showAssessment ? "assessment" : "apply",
          message: message || undefined,
          assessmentAnswers: capturesStructuredAnswers ? answers : undefined,
          turnstileToken,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "failed");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message !== "failed" ? err.message : "Something went wrong submitting this — please try again.");
      if (window.turnstile) {
        window.turnstile.reset();
        setTurnstileToken("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (notFound) return <p style={{ color: "var(--v2-danger)" }}>This link isn&apos;t recognized. Double-check the URL you were given.</p>;
  if (loadError) return <p style={{ color: "var(--v2-danger)" }}>{loadError}</p>;

  if (done) {
    return (
      <div className="v2-public-success">
        <h1>Thank you{fullName ? `, ${fullName.split(" ")[0]}` : ""}.</h1>
        <p>
          {showAssessment
            ? "Your eligibility details have been received. Someone from the team will follow up on next steps."
            : "Your submission has been received. Someone from the team will be in touch."}
        </p>
        {pmpFacts && (
          <div
            style={{
              marginTop: "var(--v2-space-4)",
              padding: "var(--v2-space-4)",
              border: "1px solid var(--v2-border)",
              borderRadius: "var(--v2-radius, 8px)",
              background: "var(--v2-surface-sunken, transparent)",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "var(--v2-space-2)" }}>PMP Eligibility Check</div>
            <div style={{ display: "grid", gap: 6, fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "var(--v2-text-muted)" }}>Education pathway: </span>
                <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{pmpFacts.pathway ? pmpFacts.pathway.label : "Not specified"}</span>
              </div>
              <div>
                <span style={{ color: "var(--v2-text-muted)" }}>Reported experience: </span>
                <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>
                  {pmpFacts.reportedMonths !== null ? `${pmpFacts.reportedMonths} months` : "Not specified"}
                  {pmpFacts.pathway ? ` (pathway requires ${pmpFacts.pathway.requiredMonths} months)` : ""}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--v2-text-muted)" }}>Within PMI's 10-year window: </span>
                <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{pmpFacts.recency ?? "Not specified"}</span>
              </div>
              <div>
                <span style={{ color: "var(--v2-text-muted)" }}>Training: </span>
                <span style={{ color: "var(--v2-text)", fontWeight: 500 }}>{pmpFacts.training ?? "Not specified"}</span>
              </div>
            </div>
            <p style={{ marginTop: "var(--v2-space-3)", fontWeight: 500 }}>{pmpFacts.statement}</p>
            <p style={{ marginTop: "var(--v2-space-2)", fontSize: "0.78rem", color: "var(--v2-text-faint)" }}>
              This is a plain read of what you told us against PMI&apos;s published requirements — not an official PMI determination.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (stage === "entry") {
    const categories = orderedCategories(nonCertProducts);
    return (
      <>
        <h1>{orgName ? `Get started with ${orgName}` : "Get started"}</h1>
        <p className="v2-public-intro">What can we help you with?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          {categories.map((cat) => (
            <TrackCard
              key={cat}
              title={cat}
              description={sampleNames(nonCertProducts.filter((p) => p.category === cat))}
              onClick={() => chooseEntry({ kind: "category", category: cat })}
            />
          ))}
          {certProducts.length > 0 && (
            <TrackCard
              title="Certification & Professional Readiness"
              description={sampleNames(certProducts)}
              onClick={() => chooseEntry({ kind: "certification" })}
            />
          )}
          <TrackCard
            title="I'm not sure"
            description="Tell us a bit about what you need and we'll point you in the right direction."
            onClick={() => chooseEntry({ kind: "not_sure" })}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{entryTitle()}</h1>
      <p className="v2-public-intro">
        {isPmpEligibility
          ? "A few questions about your education and experience so we can check them against PMI's published PMP eligibility criteria before you commit to a program. This isn't an official PMI determination — it's how we get you the right guidance."
          : showAssessment
            ? "A few questions about your education and experience so we understand where you're starting from before you commit to a program."
            : "A few quick questions so we understand what you need before we talk — nothing here commits you to anything."}
      </p>

      {usingProductPicker && (
        <button type="button" onClick={backToEntry} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem", marginBottom: "var(--v2-space-4)" }}>
          ← Choose a different category
        </button>
      )}

      <form onSubmit={handleSubmit}>
        {usingProductPicker ? (
          <div className="v2-public-field">
            <label htmlFor="productServiceId">What are you interested in?</label>
            <select
              id="productServiceId"
              className="v2-input"
              value={productServiceId}
              onChange={(e) => {
                setProductServiceId(e.target.value);
                setAnswers({});
              }}
              required
            >
              <option value="">Select one…</option>
              {entryProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProduct?.description && <p className="v2-public-hint">{selectedProduct.description}</p>}
          </div>
        ) : (
          services.length > 0 && (
            <div className="v2-public-field">
              <label htmlFor="serviceId">What are you interested in?</label>
              <select id="serviceId" className="v2-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
                <option value="">Select one…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {services.find((s) => s.id === serviceId)?.customerNeed && (
                <p className="v2-public-hint">{services.find((s) => s.id === serviceId)?.customerNeed}</p>
              )}
            </div>
          )
        )}

        {showAssessment &&
          assessmentQuestions.map((q) => (
            <QuestionField key={q.key} q={q} value={answers[q.key] ?? ""} onChange={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))} />
          ))}

        {isGeneralDiscovery && (
          <>
            {DISCOVERY_QUESTIONS.map((q) => (
              <QuestionField key={q.key} q={q} value={answers[q.key] ?? ""} onChange={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))} />
            ))}
            {adaptiveQuestion && (
              <QuestionField q={adaptiveQuestion} value={answers[adaptiveQuestion.key] ?? ""} onChange={(v) => setAnswers((prev) => ({ ...prev, [adaptiveQuestion.key]: v }))} />
            )}
          </>
        )}

        {!showAssessment && (
          <div className="v2-public-field">
            <label htmlFor="message">Anything else GDC should understand before we speak? (optional)</label>
            <textarea id="message" className="v2-input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        )}

        <div className="v2-public-field">
          <label htmlFor="fullName">Full name</label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="v2-public-field">
          <label htmlFor="email">Email</label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="v2-public-field">
          <label htmlFor="phone">Phone</label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        {turnstileSiteKey && (
          <div className="v2-public-field">
            <div ref={turnstileContainerRef} />
          </div>
        )}

        {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.85rem", margin: "0 0 var(--v2-space-3)" }}>{error}</p>}

        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Submitting…" : showAssessment ? "Submit eligibility check" : "Submit"}
        </Button>
      </form>
    </>
  );
}

function QuestionField({ q, value, onChange }: { q: { key: string; label: string; type: "select" | "text" | "number"; options?: string[] }; value: string; onChange: (v: string) => void }) {
  return (
    <div className="v2-public-field">
      <label htmlFor={q.key}>{q.label}</label>
      {q.type === "select" ? (
        <select id={q.key} className="v2-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select one…</option>
          {q.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : q.type === "number" ? (
        <Input id={q.key} type="number" min="0" step="1" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea id={q.key} className="v2-input" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function TrackCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "var(--v2-space-4)",
        border: "1px solid var(--v2-border)",
        borderRadius: "var(--v2-radius)",
        background: "var(--v2-surface-sunken, transparent)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--v2-text)" }}>{title}</div>
      {description && <div style={{ fontSize: "0.85rem", color: "var(--v2-text-faint)", marginTop: 4 }}>{description}</div>}
    </button>
  );
}
