"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Customer } from "@/components/customers/types";

// v3.0 roadmap Phase 10 (Cluster C) — "no create or edit form exists at
// all" for Customers; this is the create half (CustomerItem.tsx has the
// edit half). Open creation, no service picker — a Customer isn't tied
// to one service the way a Task/Lead/Class is (see
// app/api/customers/route.ts). Submitting an email that already exists
// on file returns that existing customer rather than a duplicate — the
// same rule lead admission has always used — surfaced here with a
// plain note rather than silently doing nothing.
export function NewCustomerForm({ onCreated }: { onCreated: (customer: Customer) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email: email || undefined, phone: phone || undefined, organizationName: organizationName || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't add customer");
      }
      const result = await res.json();
      const { existed, ...customer } = result as Customer & { existed: boolean };
      onCreated(customer);
      if (existed) setNote(`${customer.fullName} was already on file — showing the existing record.`);
      setFullName("");
      setEmail("");
      setPhone("");
      setOrganizationName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ flex: "1 1 200px" }} />
        <Input type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: "1 1 200px" }} />
        <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: "1 1 160px" }} />
        <Input placeholder="Organization (optional)" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} style={{ flex: "1 1 180px" }} />
        <Button type="submit" loading={busy} disabled={!fullName.trim()}>
          {busy ? "Adding…" : "Add customer"}
        </Button>
      </div>
      {note && <p style={{ color: "var(--v2-text-muted)", fontSize: "0.85rem", margin: 0 }}>{note}</p>}
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
    </form>
  );
}
