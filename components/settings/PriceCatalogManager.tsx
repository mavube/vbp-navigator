"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  currency: string;
  taxRate: number | null;
  active: boolean;
  sortOrder: number;
  category: string;
  offeringType: string;
  targetCustomer: string;
  standardOffering: string;
  deliveryModel: string;
  typicalDuration: string;
  pricingModel: string;
  included: string;
  expectedOutcome: string;
  requiredCapabilities: string[];
  relatedDocuments: string;
  createdByName: string;
  createdAt: string;
}

interface ServiceOption {
  id: string;
  name: string;
}

// Post-Phase-G, third confirmed next step ("this is a decision-
// supporting system, not QuickBooks or Tally"): the catalog previously
// showed what GDC could charge for an offering, never what actually
// happened with it. These two lightweight shapes carry only the real
// fields needed to compute that — productServiceId (Engagement) and
// catalogItemId (a commercial document's line item) are both existing
// links, nothing new added to the schema.
interface EngagementLite {
  productServiceId: string | null;
  status: string;
}
interface CommercialDocLite {
  docType: string;
  status: string;
  paymentStatus: string;
  currency: string;
  lineItems: { catalogItemId?: string | null; quantity: number; unitAmount: number }[];
}

interface CatalogItemStats {
  activeEngagements: number;
  totalEngagements: number;
  // Keyed by currency rather than summed across currencies — an item
  // sold in both TZS and USD gets two real totals, never one
  // meaningless blended number.
  invoiced: Record<string, number>;
  collected: Record<string, number>;
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface FormState {
  name: string;
  description: string;
  unitPrice: string;
  currency: string;
  taxRate: string;
  category: string;
  offeringType: string;
  targetCustomer: string;
  standardOffering: string;
  deliveryModel: string;
  typicalDuration: string;
  pricingModel: string;
  included: string;
  expectedOutcome: string;
  relatedDocuments: string;
  requiredCapabilities: string[];
}

const EMPTY_NEW: FormState = {
  name: "", description: "", unitPrice: "0", currency: "TZS", taxRate: "",
  category: "", offeringType: "", targetCustomer: "", standardOffering: "",
  deliveryModel: "", typicalDuration: "", pricingModel: "", included: "",
  expectedOutcome: "", relatedDocuments: "", requiredCapabilities: [],
};

// Post-Phase-G fix (Diallo: Category/Type "currently manually filled
// in and this invites human errors or naming inconsistency... we
// should have an option to select"). These two lists are now real,
// enforced dropdowns (SuggestSelect below) rather than a soft
// datalist behind a free-text input — the values themselves are
// unchanged from the "NavigatorOS Operating Model Refinement" brief
// (SS3), already grounded in GDC's real named CVS (see
// claude/vbp-gdc-pmp-case-study.md). Both lists keep an explicit
// "Other" escape hatch (see SuggestSelect), so a genuinely new
// category or type never blocks adding an item — it's still a catalog
// operation, not a software-development exercise, just a controlled
// one now instead of free text.
const CATEGORY_SUGGESTIONS = [
  "Training & Capability Development",
  "Business Transformation & ICT Advisory",
  "Project Management & Implementation Advisory",
  "Business Process & Value Advisory",
  "Technology & Digital Solutions",
];

// New with this fix — Category answers "which GDC business line,"
// Type answers "what shape does delivering it take." Proposed against
// the offerings already named across this project's own test data
// (PMP Master Class, MS Project Training = a course; ValueBlueprint
// Advisory = an advisory engagement) — not yet independently confirmed
// value-by-value the way Category's list was, so easy to edit later
// (a plain array, same as Category) if these don't match how GDC
// actually talks about its offerings.
const TYPE_SUGGESTIONS = [
  "Certification Program",
  "Corporate Training / Course",
  "Advisory Engagement",
  "Consulting Retainer",
  "One-off Service",
];

const OTHER_VALUE = "__other__";

function toForm(item: CatalogItem): FormState {
  return {
    name: item.name, description: item.description, unitPrice: String(item.unitPrice),
    currency: item.currency, taxRate: item.taxRate === null ? "" : String(item.taxRate),
    category: item.category, offeringType: item.offeringType, targetCustomer: item.targetCustomer,
    standardOffering: item.standardOffering, deliveryModel: item.deliveryModel,
    typicalDuration: item.typicalDuration, pricingModel: item.pricingModel, included: item.included,
    expectedOutcome: item.expectedOutcome, relatedDocuments: item.relatedDocuments,
    requiredCapabilities: item.requiredCapabilities,
  };
}

function toPayload(f: FormState) {
  return {
    name: f.name, description: f.description, unitPrice: Number(f.unitPrice), currency: f.currency,
    taxRate: f.taxRate === "" ? null : Number(f.taxRate),
    category: f.category, offeringType: f.offeringType, targetCustomer: f.targetCustomer,
    standardOffering: f.standardOffering, deliveryModel: f.deliveryModel, typicalDuration: f.typicalDuration,
    pricingModel: f.pricingModel, included: f.included, expectedOutcome: f.expectedOutcome,
    relatedDocuments: f.relatedDocuments, requiredCapabilities: f.requiredCapabilities,
  };
}

// Phase 16 (portfolio correction, part 1): this started life in Phase
// 15 as a billing line-item picker for Commercial Documents. It's now
// the real Products & Services Catalog — what GDC actually sells, not
// just what a line item costs. The pricing fields (unit price/
// currency/tax) still feed the same line-item editor unchanged; the
// new "offering details" fields are what make a row describe an actual
// GDC product/service (per the brief's SS3 field list) rather than just
// a price. Org Admin only, same authority level as Company Settings.
export function PriceCatalogManager() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [engagements, setEngagements] = useState<EngagementLite[]>([]);
  const [commercialDocs, setCommercialDocs] = useState<CommercialDocLite[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState("TZS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_NEW);
  const [showNewDetails, setShowNewDetails] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Bumped on a successful add so the Category/Type SuggestSelects
  // below remount fresh via their key — otherwise a SuggestSelect left
  // in "Other" mode (its own internal state, not derivable from a now
  // -empty value alone — see that component's own comment) would stay
  // showing an empty "Other" text box after the form resets, instead
  // of cleanly going back to the placeholder.
  const [formResetKey, setFormResetKey] = useState(0);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/price-catalog", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/org-settings", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      // Both fetched org-wide (not filtered per item) so per-item stats
      // below are computed client-side from the same real link fields
      // the rest of the app already relies on — Engagement.productServiceId
      // and a line item's catalogItemId. No new endpoint needed.
      fetch("/api/customers", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/commercial-documents", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([catalogData, orgSettings, servicesData, customersData, commercialData]) => {
        setItems(catalogData);
        setDefaultCurrency(orgSettings.defaultCurrency || "TZS");
        setForm((f) => ({ ...f, currency: orgSettings.defaultCurrency || "TZS" }));
        setServices(servicesData.map((s: ServiceOption) => ({ id: s.id, name: s.name })));
        setEngagements(customersData.engagements ?? []);
        setCommercialDocs(commercialData ?? []);
        setError("");
      })
      .catch(() => setError("Couldn't load the Products & Services Catalog — try refreshing."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function serviceName(id: string): string {
    return services.find((s) => s.id === id)?.name ?? "Unknown";
  }

  // Only invoices that actually went somewhere real count — a draft or
  // rejected invoice was never sent to the customer, so it isn't
  // evidence this offering sold. "Collected" narrows further to
  // paymentStatus === "paid", the same bar CustomerDetail.tsx's own
  // totalPaid uses.
  function statsFor(itemId: string): CatalogItemStats {
    const activeEngagements = engagements.filter((e) => e.productServiceId === itemId && e.status === "active").length;
    const totalEngagements = engagements.filter((e) => e.productServiceId === itemId).length;
    const invoiced: Record<string, number> = {};
    const collected: Record<string, number> = {};
    for (const doc of commercialDocs) {
      if (doc.docType !== "invoice" || doc.status === "draft" || doc.status === "rejected") continue;
      const matched = doc.lineItems
        .filter((li) => li.catalogItemId === itemId)
        .reduce((sum, li) => sum + li.quantity * li.unitAmount, 0);
      if (matched === 0) continue;
      invoiced[doc.currency] = (invoiced[doc.currency] ?? 0) + matched;
      if (doc.paymentStatus === "paid") {
        collected[doc.currency] = (collected[doc.currency] ?? 0) + matched;
      }
    }
    return { activeEngagements, totalEngagements, invoiced, collected };
  }

  function toggleCapability(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/price-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add item");
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ ...EMPTY_NEW, currency: defaultCurrency });
      setShowNewDetails(false);
      setFormResetKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add item");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setEditForm(toForm(item));
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSavingId(id);
    setError("");
    try {
      const res = await fetch(`/api/price-catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editForm)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save changes");
      setItems((prev) => prev.map((it) => (it.id === id ? data : it)));
      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(item: CatalogItem) {
    setSavingId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/price-catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update item");
      setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update item");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Section
        title="Add a product or service"
        description="What GDC actually offers — pricing plus the offering definition. Leave tax rate blank to use the org's current VAT rate automatically."
      >
        <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Name" style={{ flex: "1 1 200px" }}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. MS Project Training" />
            </Field>
            <Field label="Category" style={{ flex: "1 1 200px" }}>
              <SuggestSelect
                key={`category-${formResetKey}`}
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={CATEGORY_SUGGESTIONS}
                placeholder="Category…"
                otherPlaceholder="e.g. a new GDC business line"
              />
            </Field>
            <Field label="Type" style={{ flex: "1 1 160px" }}>
              <SuggestSelect
                key={`type-${formResetKey}`}
                value={form.offeringType}
                onChange={(v) => setForm({ ...form, offeringType: v })}
                options={TYPE_SUGGESTIONS}
                placeholder="Type…"
                otherPlaceholder="e.g. a new offering shape"
              />
            </Field>
          </div>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Short description (optional)" style={{ flex: "1 1 300px" }}>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Unit price (tax-excl.)" style={{ width: 140 }}>
              <Input type="number" min={0} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
            </Field>
            <Field label="Currency" style={{ width: 90 }}>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 10) })} />
            </Field>
            <Field label="Tax % (blank = org default)" style={{ width: 90 }}>
              <Input type="number" min={0} max={100} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
            </Field>
          </div>

          <button
            type="button"
            className="v2-btn v2-btn-secondary"
            style={{ alignSelf: "flex-start", padding: "4px 10px", fontSize: "0.8rem" }}
            onClick={() => setShowNewDetails((v) => !v)}
          >
            {showNewDetails ? "Hide offering details" : "Add offering details (target customer, delivery model, outcome…)"}
          </button>

          {showNewDetails && (
            <OfferingDetailFields form={form} setForm={setForm} services={services} toggleCapability={toggleCapability} />
          )}

          <Button type="submit" disabled={creating || !form.name.trim()} style={{ alignSelf: "flex-start" }}>
            {creating ? "Adding…" : "Add to catalog"}
          </Button>
        </form>
      </Section>

      <Section
        title={`Catalog (${items.length})`}
        description="Deactivating an item keeps it out of the document line-item picker but never changes a document that already selected it — its price/tax were snapshotted at the time."
      >
        {items.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>
            No products or services yet — this is GDC&rsquo;s real portfolio, add what GDC actually offers above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
            {items.map((item) => (
              <Card key={item.id} style={{ padding: "var(--v2-space-3)" }}>
                {editingId === item.id && editForm ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
                    <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
                      <Field label="Name" style={{ flex: "1 1 180px" }}>
                        <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      </Field>
                      <Field label="Category" style={{ flex: "1 1 180px" }}>
                        <SuggestSelect
                          value={editForm.category}
                          onChange={(v) => setEditForm({ ...editForm, category: v })}
                          options={CATEGORY_SUGGESTIONS}
                          placeholder="Category…"
                          otherPlaceholder="e.g. a new GDC business line"
                        />
                      </Field>
                      <Field label="Type" style={{ flex: "1 1 160px" }}>
                        <SuggestSelect
                          value={editForm.offeringType}
                          onChange={(v) => setEditForm({ ...editForm, offeringType: v })}
                          options={TYPE_SUGGESTIONS}
                          placeholder="Type…"
                          otherPlaceholder="e.g. a new offering shape"
                        />
                      </Field>
                    </div>
                    <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
                      <Field label="Description" style={{ flex: "1 1 180px" }}>
                        <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                      </Field>
                      <Field label="Unit price" style={{ width: 120 }}>
                        <Input type="number" min={0} value={editForm.unitPrice} onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} />
                      </Field>
                      <Field label="Currency" style={{ width: 80 }}>
                        <Input value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase().slice(0, 10) })} />
                      </Field>
                      <Field label="Tax %" style={{ width: 80 }}>
                        <Input type="number" min={0} max={100} value={editForm.taxRate} onChange={(e) => setEditForm({ ...editForm, taxRate: e.target.value })} />
                      </Field>
                    </div>

                    <OfferingDetailFields form={editForm} setForm={(f) => setEditForm(f as FormState)} services={services} toggleCapability={toggleCapability} />

                    <div style={{ display: "flex", gap: "var(--v2-space-2)" }}>
                      <Button type="button" onClick={() => saveEdit(item.id)} disabled={savingId === item.id}>
                        {savingId === item.id ? "Saving…" : "Save"}
                      </Button>
                      <button type="button" className="v2-btn v2-btn-secondary" onClick={() => { setEditingId(null); setEditForm(null); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          {item.category && <Badge tone="neutral">{item.category}</Badge>}
                          {item.offeringType && <Badge tone="neutral">{item.offeringType}</Badge>}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
                          {item.currency} {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {" · "}{item.taxRate !== null ? `${item.taxRate}% tax` : "org default tax"}
                          {item.description ? ` · ${item.description}` : ""}
                        </div>
                        <CatalogItemPerformance stats={statsFor(item.id)} />
                      </div>
                      <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
                        <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
                        <button
                          type="button"
                          className="v2-btn v2-btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        >
                          {expandedId === item.id ? "Hide details" : "Details"}
                        </button>
                        <button type="button" className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }} onClick={() => startEdit(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="v2-btn v2-btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          onClick={() => toggleActive(item)}
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? "…" : item.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>

                    {expandedId === item.id && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem", color: "var(--v2-text)", borderTop: "1px solid var(--v2-border)", paddingTop: "var(--v2-space-2)" }}>
                        <DetailRow label="Target customer" value={item.targetCustomer} />
                        <DetailRow label="Standard offering" value={item.standardOffering} />
                        <DetailRow label="Delivery model" value={item.deliveryModel} />
                        <DetailRow label="Typical duration" value={item.typicalDuration} />
                        <DetailRow label="Pricing model" value={item.pricingModel} />
                        <DetailRow label="What's included" value={item.included} />
                        <DetailRow label="Expected outcome" value={item.expectedOutcome} />
                        <DetailRow label="Related documents" value={item.relatedDocuments} />
                        {item.requiredCapabilities.length > 0 && (
                          <DetailRow label="Required capabilities" value={item.requiredCapabilities.map(serviceName).join(", ")} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>

      {error && <p style={{ color: "var(--v2-danger)" }}>{error}</p>}
    </div>
  );
}

// The "is this actually selling" line — real engagement and invoice
// counts, not a projection. An item with no engagements and no
// invoices says so plainly ("Not sold yet") rather than showing
// nothing, since a silent blank looks like the stats simply didn't
// load.
function CatalogItemPerformance({ stats }: { stats: CatalogItemStats }) {
  const invoicedEntries = Object.entries(stats.invoiced);
  const collectedEntries = Object.entries(stats.collected);
  const hasActivity = stats.totalEngagements > 0 || invoicedEntries.length > 0;

  if (!hasActivity) {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", marginTop: 2 }}>
        Not sold yet
      </div>
    );
  }

  const engagementText = stats.activeEngagements > 0
    ? `${stats.activeEngagements} active engagement${stats.activeEngagements === 1 ? "" : "s"}${stats.totalEngagements > stats.activeEngagements ? ` (${stats.totalEngagements} total)` : ""}`
    : stats.totalEngagements > 0
      ? `${stats.totalEngagements} past engagement${stats.totalEngagements === 1 ? "" : "s"}, none active`
      : "No engagements yet";

  return (
    <div style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", marginTop: 2 }}>
      {engagementText}
      {invoicedEntries.length > 0 && (
        <>
          {" · Invoiced "}
          {invoicedEntries.map(([cur, amt]) => money(amt, cur)).join(", ")}
        </>
      )}
      {collectedEntries.length > 0 && (
        <>
          {" · Collected "}
          {collectedEntries.map(([cur, amt]) => money(amt, cur)).join(", ")}
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span style={{ color: "var(--v2-text-faint)" }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}

// Shared between the "Add a product or service" form and the inline
// edit form — every offering-definition field per the brief's SS3
// field list, minus what the compact row above already covers (name/
// description/price/currency/tax/category/type).
function OfferingDetailFields({
  form,
  setForm,
  services,
  toggleCapability,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  services: ServiceOption[];
  toggleCapability: (list: string[], id: string) => string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)", padding: "var(--v2-space-3)", background: "var(--v2-surface-subtle, rgba(0,0,0,0.02))", borderRadius: 8 }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <Field label="Target customer" style={{ flex: "1 1 220px" }}>
          <Input value={form.targetCustomer} onChange={(e) => setForm({ ...form, targetCustomer: e.target.value })} placeholder="Who this is for" />
        </Field>
        <Field label="Delivery model" style={{ flex: "1 1 180px" }}>
          <Input value={form.deliveryModel} onChange={(e) => setForm({ ...form, deliveryModel: e.target.value })} placeholder="e.g. In-person cohort, remote advisory" />
        </Field>
        <Field label="Typical duration" style={{ flex: "1 1 140px" }}>
          <Input value={form.typicalDuration} onChange={(e) => setForm({ ...form, typicalDuration: e.target.value })} placeholder="e.g. 5 days" />
        </Field>
        <Field label="Pricing model" style={{ flex: "1 1 160px" }}>
          <Input value={form.pricingModel} onChange={(e) => setForm({ ...form, pricingModel: e.target.value })} placeholder="e.g. Per participant" />
        </Field>
      </div>
      <Field label="Standard offering">
        <Textarea value={form.standardOffering} onChange={(e) => setForm({ ...form, standardOffering: e.target.value })} placeholder="What the standard engagement/offering consists of" />
      </Field>
      <Field label="What's included">
        <Textarea value={form.included} onChange={(e) => setForm({ ...form, included: e.target.value })} />
      </Field>
      <Field label="Expected outcome">
        <Textarea value={form.expectedOutcome} onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })} />
      </Field>
      <Field label="Related documents (links or names, optional)">
        <Input value={form.relatedDocuments} onChange={(e) => setForm({ ...form, relatedDocuments: e.target.value })} />
      </Field>
      {services.length > 0 && (
        <Field label="Required capabilities (internal services this draws on, optional)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {services.map((s) => {
              const selected = form.requiredCapabilities.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm({ ...form, requiredCapabilities: toggleCapability(form.requiredCapabilities, s.id) })}
                  className="v2-btn v2-btn-secondary"
                  style={{
                    padding: "3px 10px",
                    fontSize: "0.75rem",
                    background: selected ? "var(--v2-accent-subtle, #e0e7ff)" : undefined,
                    borderColor: selected ? "var(--v2-accent, #4f46e5)" : undefined,
                  }}
                >
                  {selected ? "✓ " : ""}{s.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}
    </div>
  );
}

// A real <select> against a known list, with an explicit "Other"
// option that reveals a plain text input for anything not on the
// list — used for both Category and Type. Driven entirely off `value`
// (no local state to fall out of sync with the parent form): a value
// that matches a list entry shows that entry selected; an empty value
// shows the placeholder; anything else (including legacy free-text
// values from before this fix, or GDC's own new-not-yet-listed
// category/type) is treated as "Other" and shown, unmodified, in the
// paired text input — so an existing item's category/type is never
// silently blanked out just because it doesn't match a suggestion.
function SuggestSelect({
  value,
  onChange,
  options,
  placeholder,
  otherPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  otherPlaceholder: string;
}) {
  // `otherChosen` is separate local state, not purely derived from
  // `value` — the moment someone picks "Other (specify)" the value is
  // cleared to "" so the text field starts blank, and "" can't be told
  // apart from "nothing selected yet" by value alone. A value that
  // arrives from outside already unlisted (legacy free-text data, or a
  // fresh mount when editing a different item — see this component's
  // call sites, each keyed so switching items always remounts fresh)
  // still correctly starts in Other mode via the initializer below.
  const [otherChosen, setOtherChosen] = useState(value !== "" && !options.includes(value));
  const isOther = otherChosen || (value !== "" && !options.includes(value));
  const selectValue = isOther ? OTHER_VALUE : value;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <select
        className="v2-input"
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER_VALUE) {
            setOtherChosen(true);
            onChange("");
          } else {
            setOtherChosen(false);
            onChange(next);
          }
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other (specify)…</option>
      </select>
      {isOther && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          autoFocus
        />
      )}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", color: "var(--v2-text-faint)", ...style }}>
      {label}
      {children}
    </label>
  );
}
