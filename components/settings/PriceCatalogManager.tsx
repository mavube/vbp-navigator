"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
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
  createdByName: string;
  createdAt: string;
}

const EMPTY_NEW = { name: "", description: "", unitPrice: "0", currency: "TZS", taxRate: "" };

// Phase 15 (Diallo's "case 1" correction): the predefined-services
// price list that Commercial Documents' line-item editor now selects
// from, instead of free-typed line items — see migration 0021's file
// comment for why this is a standalone catalog, not the existing
// Service & Value Architecture services table. Org Admin only, same
// authority level as Company Settings.
export function PriceCatalogManager() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState("TZS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; unitPrice: string; currency: string; taxRate: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/price-catalog", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/org-settings", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([catalogData, orgSettings]) => {
        setItems(catalogData);
        setDefaultCurrency(orgSettings.defaultCurrency || "TZS");
        setForm((f) => ({ ...f, currency: orgSettings.defaultCurrency || "TZS" }));
        setError("");
      })
      .catch(() => setError("Couldn't load the Price Catalog — try refreshing."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/price-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          unitPrice: Number(form.unitPrice),
          currency: form.currency,
          taxRate: form.taxRate === "" ? null : Number(form.taxRate),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add item");
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ ...EMPTY_NEW, currency: defaultCurrency });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add item");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      description: item.description,
      unitPrice: String(item.unitPrice),
      currency: item.currency,
      taxRate: item.taxRate === null ? "" : String(item.taxRate),
    });
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSavingId(id);
    setError("");
    try {
      const res = await fetch(`/api/price-catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          unitPrice: Number(editForm.unitPrice),
          currency: editForm.currency,
          taxRate: editForm.taxRate === "" ? null : Number(editForm.taxRate),
        }),
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
        title="Add a catalog item"
        description="A tax-exclusive, preconfigured price — this is what staff select from instead of typing a line item by hand. Leave tax rate blank to use the org's current VAT rate automatically."
      >
        <form onSubmit={create} style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Name" style={{ flex: "1 1 200px" }}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Workshop seat (half-day)" />
          </Field>
          <Field label="Description (optional)" style={{ flex: "1 1 200px" }}>
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
          <Button type="submit" disabled={creating || !form.name.trim()}>{creating ? "Adding…" : "Add item"}</Button>
        </form>
      </Section>

      <Section title={`Catalog (${items.length})`} description="Deactivating an item keeps it out of the picker but never changes a document that already selected it — its price/tax were snapshotted at the time.">
        {items.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>No catalog items yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
            {items.map((item) => (
              <Card key={item.id} style={{ padding: "var(--v2-space-3)" }}>
                {editingId === item.id && editForm ? (
                  <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <Field label="Name" style={{ flex: "1 1 180px" }}>
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </Field>
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
                    <Button type="button" onClick={() => saveEdit(item.id)} disabled={savingId === item.id}>
                      {savingId === item.id ? "Saving…" : "Save"}
                    </Button>
                    <button type="button" className="v2-btn v2-btn-secondary" onClick={() => { setEditingId(null); setEditForm(null); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
                        {item.currency} {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {" · "}{item.taxRate !== null ? `${item.taxRate}% tax` : "org default tax"}
                        {item.description ? ` · ${item.description}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center" }}>
                      <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
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

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", color: "var(--v2-text-faint)", ...style }}>
      {label}
      {children}
    </label>
  );
}
