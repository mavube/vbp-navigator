"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface PublicService {
  id: string;
  name: string;
  description: string;
  customerNeed: string;
}

// Phase C (portfolio correction) — the real Products & Services Catalog
// counterpart to PublicService above. Preferred whenever the org's
// catalog has active items: a prospect applying to GDC should choose
// from GDC's actual, sellable offerings, not from the internal Service
// & Value Architecture's process-step list (Readiness Assessment,
// Candidate Admission, ...), which is what this form used exclusively
// before this phase. Falls back to the service list below whenever the
// catalog is empty, so this form never has nothing to offer.
interface PublicProduct {
  id: string;
  name: string;
  category: string;
  description: string;
}

// Shared by /apply and /assess (v3.0 roadmap Phase 4, §6-7) — same
// contact fields and submit flow either way; "assess" mode adds a
// short self-assessment questionnaire and tags the resulting prospect
// source: "assessment" so staff reviewing /prospects can tell the two
// apart. These questions are VBP's own intake questionnaire, not a
// reproduction of PMI's actual PMP certification eligibility criteria
// (which this app has no source for) — framed that way on the page
// itself so nobody mistakes it for an official eligibility check.
const ASSESSMENT_QUESTIONS: Array<{ key: string; label: string; type: "select" | "text"; options?: string[] }> = [
  { key: "experience", label: "Years of project-related work experience", type: "select", options: ["Less than 1 year", "1–3 years", "3–5 years", "5+ years"] },
  { key: "certification", label: "Do you currently hold a related certification or qualification?", type: "select", options: ["No", "Yes — in progress", "Yes — completed"] },
  { key: "timing", label: "Preferred start timing", type: "select", options: ["As soon as possible", "Next quarter", "Just exploring for now"] },
  { key: "motivation", label: "What's prompting you to pursue this now?", type: "text" },
];

export function ApplyForm({ orgSlug, mode }: { orgSlug: string; mode: "apply" | "assess" }) {
  const [services, setServices] = useState<PublicService[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [productServiceId, setProductServiceId] = useState("");
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Phase C: prefer the real catalog once it has active items; fall
  // back to the internal-service list (this form's original picker)
  // whenever the catalog is empty, so the form always has something to
  // offer even before Diallo has entered GDC's full portfolio.
  const usingProductPicker = products.length > 0;

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
        setProducts(productData.products ?? []);
        if (productData.products?.length === 1) {
          setProductServiceId(productData.products[0].id);
        } else if (!productData.products?.length && serviceData.services.length === 1) {
          setServiceId(serviceData.services[0].id);
        }
      })
      .catch(() => setError("Couldn't load this page right now — try again shortly."))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("Your name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/org/${orgSlug}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          serviceId: serviceId || undefined,
          productServiceId: productServiceId || undefined,
          source: mode === "assess" ? "assessment" : "apply",
          message: mode === "apply" ? message : undefined,
          assessmentAnswers: mode === "assess" ? answers : undefined,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setDone(true);
    } catch {
      setError("Something went wrong submitting this — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (notFound) return <p style={{ color: "var(--v2-danger)" }}>This link isn&apos;t recognized. Double-check the URL you were given.</p>;

  if (done) {
    return (
      <div className="v2-public-success">
        <h1>Thank you{fullName ? `, ${fullName.split(" ")[0]}` : ""}.</h1>
        <p>
          {mode === "assess"
            ? "Your readiness assessment has been received. Someone from the team will follow up on next steps."
            : "Your application has been received. Someone from the team will be in touch."}
        </p>
      </div>
    );
  }

  return (
    <>
      <h1>{mode === "assess" ? "Professional Readiness Assessment" : `Apply${orgName ? ` to ${orgName}` : ""}`}</h1>
      <p className="v2-public-intro">
        {mode === "assess"
          ? "A short self-assessment to help us understand where you're starting from before you commit to a program. This isn't an official certification eligibility check — it's how we get you the right guidance."
          : "Tell us a bit about yourself and what you're interested in, and we'll be in touch."}
      </p>

      <form onSubmit={handleSubmit}>
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

        {usingProductPicker ? (
          <div className="v2-public-field">
            <label htmlFor="productServiceId">What are you interested in?</label>
            <select
              id="productServiceId"
              className="v2-input"
              value={productServiceId}
              onChange={(e) => setProductServiceId(e.target.value)}
              required
            >
              <option value="">Select one…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {products.find((p) => p.id === productServiceId)?.description && (
              <p className="v2-public-hint">{products.find((p) => p.id === productServiceId)?.description}</p>
            )}
          </div>
        ) : (
          services.length > 0 && (
            <div className="v2-public-field">
              <label htmlFor="serviceId">What are you interested in?</label>
              <select
                id="serviceId"
                className="v2-input"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
              >
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

        {mode === "apply" && (
          <div className="v2-public-field">
            <label htmlFor="message">Anything else we should know? (optional)</label>
            <textarea
              id="message"
              className="v2-input"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        )}

        {mode === "assess" &&
          ASSESSMENT_QUESTIONS.map((q) => (
            <div className="v2-public-field" key={q.key}>
              <label htmlFor={q.key}>{q.label}</label>
              {q.type === "select" ? (
                <select
                  id={q.key}
                  className="v2-input"
                  value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                >
                  <option value="">Select one…</option>
                  {q.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  id={q.key}
                  className="v2-input"
                  rows={3}
                  value={answers[q.key] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                />
              )}
            </div>
          ))}

        {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.85rem", margin: "0 0 var(--v2-space-3)" }}>{error}</p>}

        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Submitting…" : mode === "assess" ? "Submit assessment" : "Submit application"}
        </Button>
      </form>
    </>
  );
}
