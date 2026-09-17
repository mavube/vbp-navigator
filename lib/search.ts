// v3.0 roadmap Phase 11 (Cluster D) — the new Topbar's global search.
// "Topbar... doesn't exist at all" was the audit's own wording; one of
// the things worth adding once it does is "global search across
// services/tasks/leads/classes." Implemented as an in-process filter
// over each module's existing, already org-scoped list* function
// rather than a new raw-SQL LIKE/ILIKE query per table — this app's
// data volumes are small (a single org's services/tasks/leads/classes,
// not a multi-tenant search index), and reusing the same functions
// every list page already calls means search can never drift out of
// sync with what those pages show, or need separate Postgres/SQLite
// LIKE-vs-ILIKE handling (see lib/db-driver.ts's own note on why this
// app avoids exactly that kind of driver-specific SQL where a plain
// in-process filter works).

import { listServices } from "@/lib/db-services";
import { listTasks } from "@/lib/db-tasks";
import { listLeads } from "@/lib/db-leads";
import { listClasses } from "@/lib/db-classes";
import { listCustomers } from "@/lib/db-customers";
import { listProspects } from "@/lib/db-prospects";

export interface SearchResult {
  type: "service" | "task" | "lead" | "class" | "customer" | "prospect";
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

const MAX_PER_TYPE = 5;
const MAX_TOTAL = 20;

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export async function globalSearch(orgId: string, rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const [services, tasks, leads, classes, customers, prospects] = await Promise.all([
    listServices(orgId),
    listTasks(orgId),
    listLeads(orgId),
    listClasses(orgId),
    listCustomers(orgId),
    listProspects(orgId),
  ]);

  const results: SearchResult[] = [];

  for (const s of services) {
    if (matches(s.name, query) || matches(s.department, query)) {
      results.push({ type: "service", id: s.id, label: s.name, sublabel: s.department, href: `/tasks?service=${s.id}` });
    }
    if (results.filter((r) => r.type === "service").length >= MAX_PER_TYPE) break;
  }

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "";

  for (const t of tasks) {
    if (results.filter((r) => r.type === "task").length >= MAX_PER_TYPE) break;
    if (matches(t.title, query)) {
      results.push({ type: "task", id: t.id, label: t.title, sublabel: serviceName(t.serviceId), href: `/tasks?service=${t.serviceId}` });
    }
  }

  for (const l of leads) {
    if (results.filter((r) => r.type === "lead").length >= MAX_PER_TYPE) break;
    if (matches(l.contactName, query)) {
      results.push({ type: "lead", id: l.id, label: l.contactName, sublabel: serviceName(l.serviceId), href: `/pipeline?service=${l.serviceId}` });
    }
  }

  for (const c of classes) {
    if (results.filter((r) => r.type === "class").length >= MAX_PER_TYPE) break;
    if (matches(c.title, query)) {
      results.push({ type: "class", id: c.id, label: c.title, sublabel: c.scheduledDate ?? "Unscheduled", href: `/classes` });
    }
  }

  for (const c of customers) {
    if (results.filter((r) => r.type === "customer").length >= MAX_PER_TYPE) break;
    if (matches(c.fullName, query) || (c.email && matches(c.email, query))) {
      results.push({ type: "customer", id: c.id, label: c.fullName, sublabel: c.email || c.organizationName || "Customer", href: `/customers` });
    }
  }

  for (const p of prospects) {
    if (results.filter((r) => r.type === "prospect").length >= MAX_PER_TYPE) break;
    if (matches(p.fullName, query)) {
      results.push({ type: "prospect", id: p.id, label: p.fullName, sublabel: p.status, href: `/prospects` });
    }
  }

  return results.slice(0, MAX_TOTAL);
}
