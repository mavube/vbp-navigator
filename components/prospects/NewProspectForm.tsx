"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Prospect, ServiceOption } from "@/components/prospects/types";

// v3.0 roadmap Phase 10 (Cluster C) — the staff-facing counterpart to
// /apply and /assess: someone who called or emailed in, logged here
// instead of only living in an inbox. Enters the same review queue
// (ProspectsWorkspace.tsx's "Needs review" section) as any public
// submission — source is always 'manual', set server-side regardless
// of what this form sends (see app/api/prospects/route.ts).
export function NewProspectForm({ services, onCreated }: { services: ServiceOption[]; onCreated: (p: Prospect) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cvsServices = services.filter((s) => s.type === "cvs");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email: email || undefined, phone: phone || undefined, serviceId: serviceId || undefined, message: message || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't log inquiry");
      }
      const prospect: Prospect = await res.json();
      onCreated(prospect);
      setFullName("");
      setEmail("");
      setPhone("");
      setServiceId("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log inquiry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
        <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ flex: "1 1 180px" }} />
        <Input type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: "1 1 180px" }} />
        <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: "1 1 140px" }} />
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="v2-input" style={{ maxWidth: 220 }}>
          <option value="">Which service (optional)…</option>
          {cvsServices.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <textarea
        className="v2-input"
        rows={2}
        placeholder="What did they ask about? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div>
        <Button type="submit" loading={busy} disabled={!fullName.trim()}>
          {busy ? "Logging…" : "Log inquiry"}
        </Button>
      </div>
      {error && <p style={{ color: "var(--v2-danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
    </form>
  );
}
