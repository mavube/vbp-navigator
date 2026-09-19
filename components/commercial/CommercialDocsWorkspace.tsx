"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { NewCommercialDocumentForm } from "@/components/commercial/NewCommercialDocumentForm";
import { CommercialDocumentItem } from "@/components/commercial/CommercialDocumentItem";
import { isOverdueInvoice, daysOverdue, isStalledDocument, daysSince } from "@/lib/commercial-doc-signals";
import type { CommercialDocument, ServiceOption, LeadOption, EngagementOption, CustomerOption, PriceCatalogItemOption } from "@/components/commercial/types";

export function CommercialDocsWorkspace() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [catalogItems, setCatalogItems] = useState<PriceCatalogItemOption[]>([]);
  const [orgVatRate, setOrgVatRate] = useState(0);
  const [defaultCurrency, setDefaultCurrency] = useState("TZS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/leads", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/customers", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/commercial-documents", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/price-catalog", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/org-settings", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([servicesData, leadsData, customersData, documentsData, catalogData, orgSettings]) => {
        setServices(servicesData);
        setLeads(leadsData);
        setCustomers(customersData.customers);
        setEngagements(customersData.engagements);
        setDocuments(documentsData);
        setCatalogItems(catalogData);
        setOrgVatRate(orgSettings.vatRegistered ? orgSettings.vatRate : 0);
        setDefaultCurrency(orgSettings.defaultCurrency || "TZS");
        setError("");
      })
      .catch(() => setError("Couldn't load Commercial Docs — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  function replace(updated: CommercialDocument) {
    setDocuments((prev) => (prev.some((d) => d.id === updated.id) ? prev.map((d) => (d.id === updated.id ? updated : d)) : [updated, ...prev]));
  }

  const inProgress = documents.filter((d) => ["draft", "under_review", "rejected"].includes(d.status));
  const readyOrOut = documents.filter((d) => ["approved", "issued", "sent", "delivered"].includes(d.status));
  const closed = documents.filter((d) => d.status === "acknowledged");

  // Post-Phase-G, third confirmed next step: everything actually
  // sitting and needing a human, surfaced in one place instead of
  // requiring every document to be opened to find out. Overdue takes
  // priority over stalled when a doc somehow qualifies as both.
  const overdueDocs = documents.filter((d) => isOverdueInvoice(d));
  const stalledDocs = documents.filter((d) => isStalledDocument(d) && !isOverdueInvoice(d));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      {(overdueDocs.length > 0 || stalledDocs.length > 0) && (
        <Section
          title={`Needs attention (${overdueDocs.length + stalledDocs.length})`}
          description="Invoices past their due date, and proposals or quotations sent with no reply in a while — nothing new happened here, they're just sitting."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overdueDocs.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", fontSize: "0.85rem", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "8px 12px", flexWrap: "wrap" }}>
                <div>
                  <Badge tone="danger">Overdue {daysOverdue(d.dueDate as string)}d</Badge>{" "}
                  <span style={{ marginLeft: 6 }}>{d.title}</span>
                </div>
                <div style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>{d.recipientName}</div>
              </div>
            ))}
            {stalledDocs.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--v2-space-2)", fontSize: "0.85rem", border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius)", padding: "8px 12px", flexWrap: "wrap" }}>
                <div>
                  <Badge tone="warning">No response {daysSince(d.sentAt as string)}d</Badge>{" "}
                  <span style={{ marginLeft: 6 }}>{d.title}</span>
                </div>
                <div style={{ color: "var(--v2-text-faint)", fontSize: "0.75rem" }}>{d.recipientName}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Create a document"
        description="A Proposal, Quotation, or Invoice — each can stand on its own (no prior document needed) or be converted from one that's already approved, inheriting its details instead of re-typing them."
      >
        <NewCommercialDocumentForm
          services={services}
          leads={leads}
          engagements={engagements}
          customers={customers}
          catalogItems={catalogItems}
          orgVatRate={orgVatRate}
          defaultCurrency={defaultCurrency}
          onCreated={replace}
        />
      </Section>

      <Section title={`In progress (${inProgress.length})`} description="Drafts, documents under review, and anything rejected and waiting to be reopened.">
        {inProgress.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>Nothing in progress.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {inProgress.map((d) => (
              <CommercialDocumentItem key={d.id} doc={d} onChange={replace} onConverted={replace} />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Approved & out (${readyOrOut.length})`} description="Approved, issued, sent, or delivered — awaiting the customer.">
        {readyOrOut.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>Nothing here yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {readyOrOut.map((d) => (
              <CommercialDocumentItem key={d.id} doc={d} onChange={replace} onConverted={replace} />
            ))}
          </div>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title={`Acknowledged (${closed.length})`} description="Confirmed by the customer — for an invoice, that means paid.">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {closed.map((d) => (
              <CommercialDocumentItem key={d.id} doc={d} onChange={replace} onConverted={replace} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
