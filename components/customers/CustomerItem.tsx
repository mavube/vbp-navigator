"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { Customer, Engagement, ServiceOption, ProductOption } from "@/components/customers/types";

const ENGAGEMENT_TONE: Record<string, "accent" | "success" | "neutral"> = {
  active: "accent",
  completed: "success",
  paused: "neutral",
};

// v3.0 roadmap Phase 10 (Cluster C) — the edit half of "no way to fix a
// contact detail later" (NewCustomerForm.tsx is the create half).
// Extracted out of CustomersWorkspace.tsx's inline card rendering so
// the edit-toggle state has somewhere to live per-card without turning
// the workspace into a giant per-row state machine.
export function CustomerItem({
  customer,
  engagements,
  services,
  products,
  onUpdated,
}: {
  customer: Customer;
  engagements: Engagement[];
  services: ServiceOption[];
  products: ProductOption[];
  onUpdated: (patch: Partial<Customer>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(customer.fullName);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [organizationName, setOrganizationName] = useState(customer.organizationName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function serviceName(serviceId: string): string {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }

  function productName(productServiceId: string | null): string | null {
    if (!productServiceId) return null;
    return products.find((p) => p.id === productServiceId)?.name ?? null;
  }

  async function save() {
    if (!fullName.trim()) {
      setError("Name can't be blank.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email, phone, organizationName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't save changes");
      }
      onUpdated({ fullName: fullName.trim(), email, phone, organizationName });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setBusy(false);
    }
  }

  const theirEngagements = engagements.filter((e) => e.customerId === customer.id);

  return (
    <Card
      style={{
        padding: "var(--v2-space-4)",
      }}
    >
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={{ flex: "1 1 180px" }} />
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ flex: "1 1 180px" }} />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={{ flex: "1 1 140px" }} />
            <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Organization" style={{ flex: "1 1 160px" }} />
          </div>
          <div style={{ display: "flex", gap: "var(--v2-space-2)" }}>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className={`v2-btn v2-btn-primary ${busy ? "v2-btn-busy" : ""}`}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              {busy && <Spinner size={11} />}
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(""); setFullName(customer.fullName); setEmail(customer.email); setPhone(customer.phone); setOrganizationName(customer.organizationName); }}
              disabled={busy}
              className="v2-btn v2-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Cancel
            </button>
          </div>
          {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: 0 }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
          <div>
            <Link href={`/customers/${customer.id}`} style={{ fontWeight: 600, color: "var(--v2-text)" }}>
              {customer.fullName}
            </Link>
            <div style={{ fontSize: "0.8rem", color: "var(--v2-text-faint)" }}>
              {[customer.email, customer.phone, customer.organizationName].filter(Boolean).join(" · ") || "No contact details on file"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", alignSelf: "flex-start" }}>
            <Link href={`/customers/${customer.id}`} className="v2-btn v2-btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
              Open
            </Link>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="v2-btn v2-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {theirEngagements.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "var(--v2-space-3)" }}>
          {theirEngagements.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "var(--v2-space-2)", fontSize: "0.85rem" }}>
              <Badge tone={ENGAGEMENT_TONE[e.status] ?? "neutral"}>{e.status}</Badge>
              <span>{productName(e.productServiceId) ?? serviceName(e.serviceId)}</span>
              <span style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>
                since {new Date(e.startedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
