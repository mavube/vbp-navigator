"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
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
      <Card>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.05rem", margin: "0 0 var(--v2-space-3)" }}>
          Generate a document
        </h2>
        <NewDocumentForm
          services={services}
          leads={leads}
          engagements={engagements}
          customers={customers}
          onCreated={(doc) => setDocuments((prev) => [doc, ...prev])}
        />
      </Card>

      <div>
        <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
          Needs attention ({needsAttention.length})
        </h2>
        {needsAttention.length === 0 ? (
          <p style={{ color: "var(--v2-text-muted)" }}>Nothing waiting on a draft or approval decision.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {needsAttention.map((d) => (
              <DocumentItem key={d.id} doc={d} onChange={(updated) => setDocuments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))} />
            ))}
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "var(--v2-font)", fontSize: "1.1rem", margin: "0 0 var(--v2-space-3)" }}>
            Closed ({closed.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--v2-space-3)" }}>
            {closed.map((d) => (
              <DocumentItem key={d.id} doc={d} onChange={(updated) => setDocuments((prev) => [updated, ...prev.filter((x) => x.id !== updated.id)])} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
