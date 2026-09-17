"use client";

import { Input } from "@/components/ui/Input";
import type { LineItem } from "@/components/commercial/types";

// Shared line-item editor — used both when creating a commercial
// document and while editing one that's still a draft. Kept as its own
// component since three call sites would otherwise duplicate the same
// add/remove/update row logic.
export function LineItemEditor({
  items,
  onChange,
  currency,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency: string;
}) {
  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitAmount) || 0), 0);

  function update(index: number, patch: Partial<LineItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, { description: "", quantity: 1, unitAmount: 0 }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "var(--v2-space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <Input
            placeholder="Description"
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            style={{ flex: "1 1 auto" }}
          />
          <Input
            type="number"
            min={0}
            placeholder="Qty"
            value={item.quantity}
            onChange={(e) => update(i, { quantity: Number(e.target.value) })}
            style={{ width: 70 }}
          />
          <Input
            type="number"
            min={0}
            placeholder="Unit price"
            value={item.unitAmount}
            onChange={(e) => update(i, { unitAmount: Number(e.target.value) })}
            style={{ width: 110 }}
          />
          <span style={{ width: 100, fontSize: "0.8rem", color: "var(--v2-text-faint)", textAlign: "right" }}>
            {currency} {(item.quantity * item.unitAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button type="button" onClick={() => remove(i)} className="v2-btn v2-btn-secondary" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>
            Remove
          </button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" onClick={add} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem", alignSelf: "flex-start" }}>
          + Add line item
        </button>
        {items.length > 0 && (
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Total: {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
