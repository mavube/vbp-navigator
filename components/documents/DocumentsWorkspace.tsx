"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { NewDocumentForm } from "@/components/documents/NewDocumentForm";
import { DocumentItem } from "@/components/documents/DocumentItem";
import type { DocumentRecord, ServiceOption, LeadOption, EngagementOption, CustomerOption } from "@/components/documents/types";

// v3.0 roadmap Phase 5 — the Document Generation Engine's UI. Pulls
// four things in parallel: services and leads (for pre-admission
// document anchors), customers+engagements (for post-admission
// anchors), and the documents themselves.
export function DocumentsWorkspace() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/leads", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/customers", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/documents", { cache: "no-store" }).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([servicesData, leadsData, customersData, documentsData]) => {
        setServices(servicesData);
        setLeads(leadsData);
        setCustomers(customersData.customers);
        setEngagements(customersData.engagements);
        setDocuments(documentsData);
        setError("");
      })
      .catch(() => setError("Couldn't load documents — try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--v2-text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--v2-danger)" }}>{error}</p>;

  const needsAttention = documents.filter((d) => d.status === "draft" || d.status === "pending_approval");
  const closed = documents.filter((d) => d.status === "approved" || d.status === "rejected");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-6)" }}>
      <Section title="Generate a document" description="Pick a document type, the lead or engagement it's for, and the specifics — a price, a date, a justification.">
        <NewDocumentForm
          services={services}
          leads={leads}
          engagements={engagements}
          customers={customers}
          onCreated={(doc) => setDocuments((prev) => [doc, ...prev])}
        />
      </Section>

      <Section title={`Needs attention (${needsAttention.length})`} description="Drafts and documents waiting on an approval decision.">
        {needsAttention.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)", margin: 0 }}>Nothing waiting on a draft or approval decision.</p>
        ) : (
          needsAttention.map((d) => (
            <DocumentItem key={d.id} doc={d} onChange={(updated) => setDocuments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))} />
          ))
        )}
      </Section>

      {closed.length > 0 && (
        <Section title={`Closed (${closed.length})`} description="Approved or rejected documents. Open a new version from any of these to revise.">
          {closed.map((d) => (
            <DocumentItem key={d.id} doc={d} onChange={(updated) => setDocuments((prev) => [updated, ...prev.filter((x) => x.id !== updated.id)])} />
          ))}
        </Section>
      )}
    </div>
  );
}
