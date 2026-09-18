"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import type { LineItem, PriceCatalogItemOption } from "@/components/commercial/types";

const CUSTOM_VALUE = "__custom__";

// Phase 15 correction (Diallo's "case 1"): "instead of having add line
// item, we should have predefined services where add line item means
// select. preconfigure price tax exluded so it is calculated after and
// per item." So "add line item" is now primarily a SELECT from the
// price catalog (Settings > Price Catalog, org-admin managed) — picking
// an item snapshots its tax-exclusive price and tax rate onto the new
// row, which then becomes read-only (the price/tax a document actually
// carries shouldn't silently drift if the catalog changes later). A
// "Custom item" option is kept for the genuine one-off case Diallo's
// phone-order workflow can still need — that row stays fully editable,
// same free-text behavior the old editor always had.
export function LineItemEditor({
  items,
  onChange,
  currency,
  catalogItems,
  orgVatRate,
  onCurrencySuggest,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency: string;
  catalogItems: PriceCatalogItemOption[];
  orgVatRate: number;
  onCurrencySuggest?: (currency: string) => void;
}) {
  const activeCatalog = catalogItems.filter((c) => c.active);
  const [selected, setSelected] = useState<string>(activeCatalog[0]?.id ?? CUSTOM_VALUE);

  function lineSubtotal(item: LineItem) {
    return (Number(item.quantity) || 0) * (Number(item.unitAmount) || 0);
  }
  function lineTax(item: LineItem) {
    return lineSubtotal(item) * ((item.taxRate ?? 0) / 100);
  }

  const subtotal = items.reduce((sum, i) => sum + lineSubtotal(i), 0);
  const taxTotal = items.reduce((sum, i) => sum + lineTax(i), 0);
  const grandTotal = subtotal + taxTotal;

  function update(index: number, patch: Partial<LineItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function addSelected() {
    if (selected === CUSTOM_VALUE) {
      onChange([...items, { description: "", quantity: 1, unitAmount: 0, taxRate: orgVatRate, catalogItemId: null }]);
      return;
    }
    const catalogItem = activeCatalog.find((c) => c.id === selected);
    if (!catalogItem) return;
    onChange([
      ...items,
      {
        description: catalogItem.name,
        quantity: 1,
        unitAmount: catalogItem.unitPrice,
        taxRate: catalogItem.taxRate ?? orgVatRate,
        catalogItemId: catalogItem.id,
      },
    ]);
    if (onCurrencySuggest && items.length === 0 && catalogItem.currency !== currency) {
      onCurrencySuggest(catalogItem.currency);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      {items.map((item, i) => {
        const fromCatalog = Boolean(item.catalogItemId);
        return (
          <div key={i} style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap" }}>
            {fromCatalog ? (
              <span style={{ flex: "1 1 auto", fontSize: "0.85rem" }}>{item.description}</span>
            ) : (
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) => update(i, { description: e.target.value })}
                style={{ flex: "1 1 auto" }}
              />
            )}
            <Input
              type="number"
              min={0}
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => update(i, { quantity: Number(e.target.value) })}
              style={{ width: 70 }}
            />
            {fromCatalog ? (
              <span style={{ width: 110, fontSize: "0.8rem", color: "var(--v2-text-faint)", textAlign: "right" }}>
                {currency} {item.unitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <Input
                type="number"
                min={0}
                placeholder="Unit price (tax-excl.)"
                value={item.unitAmount}
                onChange={(e) => update(i, { unitAmount: Number(e.target.value) })}
                style={{ width: 130 }}
              />
            )}
            <Input
              type="number"
              min={0}
              max={100}
              title="Tax rate %"
              value={item.taxRate ?? 0}
              onChange={(e) => update(i, { taxRate: Number(e.target.value) })}
              style={{ width: 64 }}
              disabled={fromCatalog}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--v2-text-faint)" }}>%</span>
            <span style={{ width: 110, fontSize: "0.8rem", color: "var(--v2-text-faint)", textAlign: "right" }}>
              {currency} {(lineSubtotal(item) + lineTax(item)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <button type="button" onClick={() => remove(i)} className="v2-btn v2-btn-secondary" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>
              Remove
            </button>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap" }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="v2-input" style={{ flex: "1 1 260px", padding: "4px 8px", fontSize: "0.8rem" }}>
          {activeCatalog.length === 0 && <option value={CUSTOM_VALUE}>No catalog items yet — add a custom line</option>}
          {activeCatalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.currency} {c.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {c.taxRate !== null ? ` (+${c.taxRate}% tax)` : " (org default tax)"}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>Custom item (not in catalog)…</option>
        </select>
        <button type="button" onClick={addSelected} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
          + Add line item
        </button>
        {items.length > 0 && (
          <span style={{ fontSize: "0.85rem", fontWeight: 600, marginLeft: "auto" }}>
            Subtotal {currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {taxTotal > 0 && <> + Tax {currency} {taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
            {" "}= {currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
