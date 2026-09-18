"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { NewCommercialDocumentForm } from "@/components/commercial/NewCommercialDocumentForm";
import { CommercialDocumentItem } from "@/components/commercial/CommercialDocumentItem";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
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
