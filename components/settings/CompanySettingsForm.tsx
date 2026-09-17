"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

interface Settings {
  legalName: string;
  registrationNumber: string;
  tin: string;
  address: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  vatRegistered: boolean;
  vatNumber: string;
  vatRate: number;
  defaultCurrency: string;
  paymentTermsText: string;
  turnstileSiteKey: string;
  mailtrapFromEmail: string;
  mailtrapFromName: string;
  updatedByName: string;
  updatedAt: string | null;
}

const EMPTY: Settings = {
  legalName: "", registrationNumber: "", tin: "", address: "", bankName: "", bankAccountName: "",
  bankAccountNumber: "", bankBranch: "", vatRegistered: false, vatNumber: "", vatRate: 0,
  defaultCurrency: "TZS", paymentTermsText: "", turnstileSiteKey: "", mailtrapFromEmail: "",
  mailtrapFromName: "", updatedByName: "", updatedAt: null,
};

// Phase 14 production readiness, Area 1: the legal/banking identity
// that flows onto every generated commercial document's PDF footer,
// instead of being baked into code (see migration 0020's file comment
// for why this exists). Full-replace PATCH, same "read it, edit it,
// write the whole thing back" shape as the rest of this app's
// single-row settings.
export function CompanySettingsForm() {
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/org-settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSettings(data))
      .catch(() => setError("Couldn't load Company Settings — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/org-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save Company Settings");
      setSettings(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save Company Settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Section title="Legal identity" description="Prints on every Proposal, Quotation, and Invoice PDF.">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <Field label="Registered legal name">
            <Input value={settings.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="e.g. Global Development Consultants Ltd" />
          </Field>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
            <Field label="Registration number" style={{ flex: "1 1 220px" }}>
              <Input value={settings.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            </Field>
            <Field label="TIN" style={{ flex: "1 1 220px" }}>
              <Input value={settings.tin} onChange={(e) => set("tin", e.target.value)} />
            </Field>
          </div>
          <Field label="Address">
            <textarea className="v2-input" rows={2} value={settings.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="VAT" description="When registered, VAT is added to every invoice's total automatically.">
        <div style={{ display: "flex", gap: "var(--v2-space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
            <input type="checkbox" checked={settings.vatRegistered} onChange={(e) => set("vatRegistered", e.target.checked)} />
            VAT registered
          </label>
          {settings.vatRegistered && (
            <>
              <Field label="VAT number" style={{ flex: "1 1 200px" }}>
                <Input value={settings.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} />
              </Field>
              <Field label="VAT rate (%)" style={{ width: 120 }}>
                <Input type="number" min={0} max={100} value={settings.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
              </Field>
            </>
          )}
        </div>
      </Section>

      <Section title="Banking" description="Shown as a bank-transfer fallback on every invoice, alongside the DPO payment link.">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
            <Field label="Bank name" style={{ flex: "1 1 200px" }}>
              <Input value={settings.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Branch" style={{ flex: "1 1 200px" }}>
              <Input value={settings.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
            <Field label="Account name" style={{ flex: "1 1 200px" }}>
              <Input value={settings.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} />
            </Field>
            <Field label="Account number" style={{ flex: "1 1 200px" }}>
              <Input value={settings.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Payment terms & currency" description="The terms text prints in small type at the foot of every commercial document.">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
          <Field label="Default currency" style={{ width: 120 }}>
            <Input value={settings.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value.toUpperCase().slice(0, 10))} />
          </Field>
          <Field label="Payment terms">
            <textarea className="v2-input" rows={2} value={settings.paymentTermsText} onChange={(e) => set("paymentTermsText", e.target.value)} placeholder="e.g. Payment due within 14 days of invoice date." />
          </Field>
        </div>
      </Section>

      <Section title="Email sending" description="The 'from' identity for real email sent via Mailtrap. The API token itself is set in Vercel, not here.">
        <div style={{ display: "flex", gap: "var(--v2-space-2)", flexWrap: "wrap" }}>
          <Field label="From address" style={{ flex: "1 1 220px" }}>
            <Input type="email" value={settings.mailtrapFromEmail} onChange={(e) => set("mailtrapFromEmail", e.target.value)} placeholder="noreply@gdc.co.tz" />
          </Field>
          <Field label="From name" style={{ flex: "1 1 220px" }}>
            <Input value={settings.mailtrapFromName} onChange={(e) => set("mailtrapFromName", e.target.value)} placeholder="GDC" />
          </Field>
        </div>
      </Section>

      <Section title="CAPTCHA (Turnstile)" description="The public site key — safe to expose. The secret key is set in Vercel, not here.">
        <Field label="Turnstile site key">
          <Input value={settings.turnstileSiteKey} onChange={(e) => set("turnstileSiteKey", e.target.value)} />
        </Field>
      </Section>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--v2-space-3)" }}>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Company Settings"}</Button>
        {saved && <span style={{ color: "#166534", fontSize: "0.85rem" }}>Saved.</span>}
        {settings.updatedAt && (
          <span style={{ color: "var(--v2-text-faint)", fontSize: "0.8rem" }}>
            Last updated {new Date(settings.updatedAt).toLocaleString()}{settings.updatedByName ? ` by ${settings.updatedByName}` : ""}
          </span>
        )}
      </div>
      {error && <p style={{ color: "var(--v2-danger)" }}>{error}</p>}
    </form>
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
