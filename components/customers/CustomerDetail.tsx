"use client";

// Phase E (Customer Workspace rebuild) — the "customer's whole story in
// one place" promise (§9 of the brief). Per the portfolio-correction
// assessment doc: identity, every Engagement (now correctly showing the
// actual product/service sold, not an internal delivery-process row —
// Phase C/D), activity (classes via enrollment, documents), the
// commercial picture (proposals/quotations/invoices/payment status),
// accountability on open commitments, and next-opportunity suggestions
// drawn from the Products & Services Catalog (Phase B/16).
//
// Honesty note: the brief also mentions "requests" and "tasks" as
// customer activity. Neither `service_requests` nor `tasks` has ever
// had a customer_id — both are scoped to an internal Service, not to
// the external person receiving it (checked lib/db-service-requests.ts
// and lib/db-tasks.ts before writing this). Rather than fabricate a
// link the schema doesn't have, this page shows what's actually real:
// Engagements, Classes (via class_enrollments), and Documents (which do
// have a real customer_id) — the same "correct the audit's wording
// against what the schema actually supports" call this project made
// for Classes' fill-rate in Phase 8.5/ai-context.ts.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { CommentThread } from "@/components/collaboration/CommentThread";
import { EngagementItem } from "@/components/customers/EngagementItem";
import { DOCUMENT_TYPE_LABELS } from "@/lib/document-templates";
import type {
  Customer,
  Engagement,
  ServiceOption,
  ProductOption,
  ClassOption,
  Enrollment,
  CustomerDocument,
} from "@/components/customers/types";

const COMMERCIAL_TYPES = new Set(["proposal", "quotation", "invoice"]);

function money(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// An "open commitment" — something a customer is waiting on GDC for
// (or GDC is waiting on the customer for), real fields only:
// - Commercial docs: anything not yet rejected/acknowledged, or unpaid.
// - Plain letters: anything not yet past draft/pending_approval.
function isOpenCommitment(d: CustomerDocument): boolean {
  if (COMMERCIAL_TYPES.has(d.docType)) {
    if (d.status === "rejected" || d.status === "acknowledged") return false;
    if (d.paymentStatus === "paid" || d.paymentStatus === "refunded") return false;
    return true;
  }
  return d.status === "draft" || d.status === "pending_approval";
}

export function CustomerDetail({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${customerId}`, { cache: "no-store" }),
      fetch("/api/customers", { cache: "no-store" }),
      fetch("/api/services", { cache: "no-store" }),
      fetch("/api/price-catalog", { cache: "no-store" }).catch(() => null),
      fetch("/api/classes", { cache: "no-store" }),
      fetch(`/api/customers/${customerId}/enrollments`, { cache: "no-store" }),
      fetch("/api/documents", { cache: "no-store" }),
      fetch("/api/commercial-documents", { cache: "no-store" }),
    ])
      .then(async ([customerRes, allCustomersRes, servicesRes, catalogRes, classesRes, enrollmentsRes, lettersRes, commercialRes]) => {
        if (customerRes.status === 404) {
          setNotFound(true);
          return;
        }
        if (!customerRes.ok || !allCustomersRes.ok || !servicesRes.ok || !classesRes.ok || !enrollmentsRes.ok || !lettersRes.ok || !commercialRes.ok) {
          throw new Error("failed");
        }
        const c: Customer = await customerRes.json();
        const { engagements: allEngagements } = await allCustomersRes.json();
        const svc: ServiceOption[] = await servicesRes.json();
        const cat: ProductOption[] = catalogRes && catalogRes.ok ? await catalogRes.json() : [];
        const cls: ClassOption[] = await classesRes.json();
        const enr: Enrollment[] = await enrollmentsRes.json();
        const letters: CustomerDocument[] = await lettersRes.json();
        const commercial: CustomerDocument[] = await commercialRes.json();

        setCustomer(c);
        setFullName(c.fullName);
        setEmail(c.email);
        setPhone(c.phone);
        setOrganizationName(c.organizationName);
        setEngagements((allEngagements as Engagement[]).filter((e) => e.customerId === customerId));
        setServices(svc);
        setProducts(cat);
        setClasses(cls);
        setEnrollments(enr);
        setDocuments(
          [...letters, ...commercial]
            .filter((d) => d.customerId === customerId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      })
      .catch(() => setError("Couldn't load this customer — try refreshing."))
      .finally(() => setLoading(false));
  }, [customerId]);

  function serviceName(serviceId: string): string {
    return services.find((s) => s.id === serviceId)?.name ?? "Unknown service";
  }
  function serviceOwner(serviceId: string): string | null {
    return services.find((s) => s.id === serviceId)?.providerName ?? null;
  }
  function productName(productServiceId: string | null): string | null {
    if (!productServiceId) return null;
    return products.find((p) => p.id === productServiceId)?.name ?? null;
  }

  async function saveIdentity() {
    if (!fullName.trim()) {
      setIdentityError("Name can't be blank.");
      return;
    }
    setSavingIdentity(true);
    setIdentityError("");
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email, phone, organizationName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't save changes");
      }
      setCustomer((prev) => (prev ? { ...prev, fullName: fullName.trim(), email, phone, organizationName } : prev));
      setEditing(false);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setSavingIdentity(false);
    }
  }

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (notFound) {
    return (
      <p style={{ color: "var(--v2-danger)" }}>
        This customer wasn&apos;t found. <Link href="/customers" style={{ color: "var(--v2-accent)" }}>Back to Customers</Link>
      </p>
    );
  }
  if (error || !customer) return <p style={{ color: "var(--v2-danger)" }}>{error || "Couldn't load this customer."}</p>;

  const classesAttending = enrollments
    .map((en) => ({ enrollment: en, cls: classes.find((c) => c.id === en.classId) }))
    .filter((x): x is { enrollment: Enrollment; cls: ClassOption } => !!x.cls);

  const openCommitments = documents.filter(isOpenCommitment);

  const totalInvoiced = documents
    .filter((d) => d.docType === "invoice" && d.amount !== null)
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const totalPaid = documents
    .filter((d) => d.docType === "invoice" && d.paymentStatus === "paid" && d.amount !== null)
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const invoiceCurrency = documents.find((d) => d.docType === "invoice")?.currency ?? "TZS";

  const ownedProductIds = new Set(engagements.map((e) => e.productServiceId).filter((id): id is string => !!id));
  const suggestions = products.filter((p) => p.active && !ownedProductIds.has(p.id)).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <div>
        <Link href="/customers" style={{ color: "var(--v2-accent)", fontSize: "0.85rem" }}>
          ← Back to Customers
        </Link>
      </div>

      <Card style={{ padding: "var(--v2-space-4)" }}>
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
                onClick={saveIdentity}
                disabled={savingIdentity}
                className={`v2-btn v2-btn-primary ${savingIdentity ? "v2-btn-busy" : ""}`}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                {savingIdentity && <Spinner size={11} />}
                {savingIdentity ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setIdentityError("");
                  setFullName(customer.fullName);
                  setEmail(customer.email);
                  setPhone(customer.phone);
                  setOrganizationName(customer.organizationName);
                }}
                disabled={savingIdentity}
                className="v2-btn v2-btn-secondary"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                Cancel
              </button>
            </div>
            {identityError && <p style={{ color: "var(--v2-danger)", fontSize: "0.8rem", margin: 0 }}>{identityError}</p>}
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-3)", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.4rem", margin: 0 }}>{customer.fullName}</h2>
              <div style={{ fontSize: "0.85rem", color: "var(--v2-text-faint)", marginTop: 4 }}>
                {[customer.email, customer.phone, customer.organizationName].filter(Boolean).join(" · ") || "No contact details on file"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--v2-text-faint)", marginTop: 4 }}>
                Customer since {new Date(customer.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="v2-btn v2-btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem", alignSelf: "flex-start" }}
            >
              Edit
            </button>
          </div>
        )}
      </Card>

      <section>
        <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Engagements ({engagements.length})
        </h3>
        {engagements.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>No engagements yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-2)" }}>
            {engagements.map((e) => (
              <EngagementItem
                key={e.id}
                engagement={e}
                serviceName={serviceName(e.serviceId)}
                productName={productName(e.productServiceId)}
                ownerName={serviceOwner(e.serviceId)}
                onUpdated={(patch) => setEngagements((prev) => prev.map((x) => (x.id === e.id ? { ...x, ...patch } : x)))}
              />
            ))}
          </div>
        )}
      </section>

      {openCommitments.length > 0 && (
        <section>
          <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
            Open commitments ({openCommitments.length})
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", margin: "0 0 var(--v2-space-3)" }}>
            Documents this customer or GDC is still waiting on — not yet accepted, paid, or resolved.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {openCommitments.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", fontSize: "0.85rem", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "8px 12px", flexWrap: "wrap" }}>
                <div>
                  <Badge tone="warning">{DOCUMENT_TYPE_LABELS[d.docType as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.docType}</Badge>{" "}
                  <span style={{ marginLeft: 6 }}>{d.title}</span>
                </div>
                <div style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>
                  {d.status}{d.dueDate ? ` · due ${new Date(d.dueDate).toLocaleDateString()}` : ""}
                  {d.issuedByName || d.createdByName ? ` · ${d.issuedByName || d.createdByName}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Commercial ({documents.filter((d) => COMMERCIAL_TYPES.has(d.docType)).length})
        </h3>
        <div style={{ display: "flex", gap: "var(--v2-space-4)", flexWrap: "wrap", marginBottom: "var(--v2-space-3)", fontSize: "0.85rem" }}>
          <div><span style={{ color: "var(--v2-text-faint)" }}>Invoiced: </span><strong>{money(totalInvoiced, invoiceCurrency)}</strong></div>
          <div><span style={{ color: "var(--v2-text-faint)" }}>Paid: </span><strong>{money(totalPaid, invoiceCurrency)}</strong></div>
          <div><span style={{ color: "var(--v2-text-faint)" }}>Outstanding: </span><strong>{money(totalInvoiced - totalPaid, invoiceCurrency)}</strong></div>
        </div>
        {documents.filter((d) => COMMERCIAL_TYPES.has(d.docType)).length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>No proposals, quotations, or invoices for this customer yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {documents.filter((d) => COMMERCIAL_TYPES.has(d.docType)).map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", fontSize: "0.85rem", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "8px 12px", flexWrap: "wrap" }}>
                <div>
                  <Badge tone="neutral">{DOCUMENT_TYPE_LABELS[d.docType as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.docType}</Badge>{" "}
                  <span style={{ marginLeft: 6 }}>{d.title}</span>
                </div>
                <div style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>
                  {money(d.amount, d.currency)} · {d.status}
                  {d.docType === "invoice" ? ` · ${d.paymentStatus}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Classes ({classesAttending.length})
        </h3>
        {classesAttending.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>Not enrolled in any classes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {classesAttending.map(({ enrollment, cls }) => (
              <div key={enrollment.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", fontSize: "0.85rem", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "8px 12px", flexWrap: "wrap" }}>
                <div>{cls.title}</div>
                <div style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>
                  {enrollment.status}{cls.scheduledDate ? ` · ${new Date(cls.scheduledDate).toLocaleDateString()}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Letters &amp; correspondence ({documents.filter((d) => !COMMERCIAL_TYPES.has(d.docType)).length})
        </h3>
        {documents.filter((d) => !COMMERCIAL_TYPES.has(d.docType)).length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>No letters on file for this customer.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {documents.filter((d) => !COMMERCIAL_TYPES.has(d.docType)).map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", fontSize: "0.85rem", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "8px 12px", flexWrap: "wrap" }}>
                <div>
                  <Badge tone="neutral">{DOCUMENT_TYPE_LABELS[d.docType as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.docType}</Badge>{" "}
                  <span style={{ marginLeft: 6 }}>{d.title}</span>
                </div>
                <div style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>{d.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section>
          <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
            Other offerings this customer hasn&apos;t bought yet
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--v2-text-muted)", margin: "0 0 var(--v2-space-3)" }}>
            Everything active in the Products &amp; Services Catalog this customer has no Engagement for — a starting point for a conversation, not a recommendation engine.
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {suggestions.map((p) => (
              <Badge key={p.id} tone="accent">{p.name}</Badge>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>Notes</h3>
        <Card style={{ padding: "var(--v2-space-4)" }}>
          <CommentThread entityType="customer" entityId={customer.id} />
        </Card>
      </section>
    </div>
  );
}
