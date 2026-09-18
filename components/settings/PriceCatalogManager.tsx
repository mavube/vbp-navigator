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

// Examples straight from the "NavigatorOS Operating Model Refinement"
// brief (SS3) — a starting point for the datalist, not an enforced
// list. Category stays free text: adding a new GDC offering (or a new
// category for one) is a catalog operation, not a software-development
// exercise.
const CATEGORY_SUGGESTIONS = [
  "Training & Capability Development",
  "Business Transformation & ICT Advisory",
  "Project Management & Implementation Advisory",
  "Business Process & Value Advisory",
  "Technology & Digital Solutions",
];

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

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/price-catalog", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/org-settings", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([catalogData, orgSettings, servicesData]) => {
        setItems(catalogData);
        setDefaultCurrency(orgSettings.defaultCurrency || "TZS");
        setForm((f) => ({ ...f, currency: orgSettings.defaultCurrency || "TZS" }));
        setServices(servicesData.map((s: ServiceOption) => ({ id: s.id, name: s.name })));
        setError("");
      })
      .catch(() => setError("Couldn't load the Products & Services Catalog — try refreshing."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function serviceName(id: string): string {
    return services.find((s) => s.id === id)?.name ?? "Unknown";
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
              <Input list="category-suggestions" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Training & Capability Development" />
            </Field>
            <Field label="Type" style={{ flex: "1 1 160px" }}>
              <Input value={form.offeringType} onChange={(e) => setForm({ ...form, offeringType: e.target.value })} placeholder="e.g. Course, Advisory Engagement" />
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
        <datalist id="category-suggestions">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
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
                        <Input list="category-suggestions" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                      </Field>
                      <Field label="Type" style={{ flex: "1 1 160px" }}>
                        <Input value={editForm.offeringType} onChange={(e) => setEditForm({ ...editForm, offeringType: e.target.value })} />
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

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", color: "var(--v2-text-faint)", ...style }}>
      {label}
      {children}
    </label>
  );
}
