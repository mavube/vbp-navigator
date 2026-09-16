# VBP Navigator OS v2.0 — Alignment: Features, Roles, Architecture

Drafted 2026-09-14, revised 2026-09-15 across three passes: (1) services vs. roles clarified, (2) role model/multi-tenancy/auth/build-order confirmed and Budget expanded, (3) payroll resolved into a real Compensation Earning Service with dual-direction invoicing and a Budget Approver role, then all remaining open questions closed out. Synthesizes `vbp-navigator-os-v2-vision.md`, `vbp-company-context.md`, `vbp-internal-service-architecture.md`, and `vbp-gdc-pmp-case-study.md` into one working reference. **All sections below are now confirmed — no open DECISION NEEDED items remain.** The last two open sub-questions (Budget Approver assignment shape, Compensation Earning Service ownership) were resolved in this pass.

## 1. What we're building, in one paragraph

A service-management platform (ITSM/PMI-flavored, not ERP-flavored) built on the ValueBlueprint® Service & Value Architecture: every organization using it maps itself as Customer Value Services (CVS) and Enabling Services rather than departments, and every unit of work — a task, a ticket, a lead, a budget item, a class, compensation, an invoice — attaches to a specific service, never to a department or just a person. VBP runs it on itself (internal tool) and also sells it to other organizations as multi-tenant SaaS running the same methodology on their own operation. The end product needs to hold up as something an organization actually runs its everyday activities on, not a diagnostic snapshot.

## 2. Core discipline (carries from v1.0, non-negotiable for v2.0)

Every new entity type below has a **required `serviceId`** field. A task, ticket, lead, budget item, compensation entry, invoice, or class with no service reference is a modeling error, not a valid record. Department stays visible as a tag for context, never as the thing anything is filed under. This is why payroll became a service (Compensation Earning Service, Section 7), not a bolt-on field.

## 3. Services vs. roles — two different layers, not one list

**Services** are the actual business functions. VBP's confirmed catalog is now 5 CVS + 5 Enabling: Demand & Engagement, Service Delivery Management, Financial & Commercial Administration, Operational Support, **Compensation Earning Service** (Section 7), plus Professional Readiness Assessment, Candidate Admission, Master Class Delivery, Post-Training Certification Support, Certification/Completion Fulfillment. This is now also reflected in `vbp-internal-service-architecture.md`. A future customer tenant defines their own catalog during onboarding.

**Roles** are permission levels, generic across whatever services a tenant has: **Org Admin, Service Owner, Contributor, Requester, Budget Approver, Viewer**. A role only means something combined with a service, except Budget Approver — see Section 4, which is org-wide by design at VBP.

## 4. Role model — CONFIRMED, including Budget Approver assignment shape

**Platform layer** (SaaS operator only — VBP itself):
- **Platform Admin** — manages tenant accounts, billing/subscription, platform-wide health.

**Org (tenant) layer:**
- **Org Admin** — Diallo.
- **Service Owner** — per-service, as before. At VBP: Anne (Master Class Delivery, Post-Training Support), Edwin (Demand & Engagement, Certification Fulfillment), Jennifer (Service Delivery Management, Financial Admin, **and now Compensation Earning Service** — she runs the monthly compensation process), Twesa (Operational Support). Any Service Owner can create/initiate a budget request for their own service.
- **Contributor** — works on tasks/tickets under a service without owning it (named backups, still the open gap at VBP per Findings 2/3).
- **Requester** — submits service requests/tickets/budget requests; default for any staff member.
- **Budget Approver** — **confirmed org-wide, not per-service.** One person (Anne, at VBP) is the final sign-off authority on every budget request across every service, regardless of which Service Owner initiated it. This is a single global role assignment, not a per-service one like Service Owner. Anne holds it for both Financial & Commercial Administration and Compensation Earning Service specifically (Jennifer runs, Anne approves, in both cases), and for budget requests originating anywhere else in the org.
- **Viewer** — read-only across the org's whole Service & Value Architecture.

A person can hold multiple roles across different services; Budget Approver is the one exception that's a single org-wide assignment rather than scoped per-service.

## 5. Module scope

| Module | What it is | ValueBlueprint® question | serviceId required? |
|---|---|---|---|
| Services (v1.0, carries forward) | CVS/Enabling, 9-field model, findings | Q1–3 | — (this IS the service) |
| Processes (Tasks) | The "how" under each service | Q4 | Yes |
| Capabilities (Workload) | Capacity view per person/service | Q5 | Yes (aggregated) |
| Technology | A field naming what runs each service | Q6 | — (field on Service) |
| Outcomes | Measured outcomes, not just described | Q7 | — (field on Service) |
| Service Requests (Ticketing) | ITSM-style request/incident tracking | — | Yes |
| Collaboration | Comments/mentions/activity, contextual | — | Yes (attaches to any entity) |
| Pipeline (Leads) | Tied to gap-flagged CVS (Assessment, Admission) | — | Yes |
| Budget | Requests, expenses, quotations, invoices (in + out) | — | Yes |
| Compensation Earning Service | Real payroll computation as its own Enabling Service | Q1–7, same as any service | — (this IS the service) |
| Classes | Instances of Master Class Delivery; auto-generates tasks | — | Yes |
| Multi-tenancy | Org-level isolation | — | (org_id, orthogonal to serviceId) |

Explicitly still out: general ledger / full double-entry bookkeeping (Budget and Compensation Earning Service produce records that could feed one, but this product isn't itself the ledger), a standalone chat product, department-only (non-service) ticketing.

## 6. Budget module — expanded scope, fully confirmed

- **Budget Request** — anyone can initiate one. Petty cash / office use (tagged to a service, typically Operational Support), or direct from the Service Owner responsible for a CVS/Enabling service, a project inside it, or a specific task.
- **Expense** — actual recorded spend, linked to a Budget Request where one exists, `serviceId`-tagged, with receipt/attachment.
- **Quotation / Proposal** — vendor's quoted price before commitment. At VBP, Jennifer is the one who typically prepares quotes (an operational note, not a new role — falls under her existing Service Owner responsibilities).
- **Invoice — two directions, both confirmed:**
  - **Incoming** — vendor's bill to VBP, tied to an Expense.
  - **Outgoing** — VBP billing its own customers (training fees), tied to a CVS/Class/Lead. **Confirmed: no approval chain needed** — this is revenue, not spend, so it doesn't route through the Budget Approver. Jennifer creates these as well.

Approval flow for spend: Requester or Service Owner submits (Quotation attached where relevant) → routes to **Anne, the org-wide Budget Approver**, regardless of which service it's against → approved/rejected → becomes an Expense once spent → Invoice (incoming) reconciled against it. Outgoing invoices generate directly against a Class/Lead with no approval step.

## 7. Compensation Earning Service — real payroll, modeled as a service — fully confirmed

Modeled as VBP's 5th Enabling Service (now reflected in `vbp-internal-service-architecture.md`), not a category on Expense.

- **Jurisdiction: Tanzania** (NSSF, WCF). Statutory deduction rates are **configurable per-org**, not hardcoded — required for future tenants who may operate under different rules, and because PAYE brackets change over time even within Tanzania.
- **Ownership: Jennifer runs the monthly compensation process (Service Owner); Anne approves (Budget Approver, org-wide role per Section 4, applied here specifically).**

Structure per pay period, per person:
```
CompensationEntry (serviceId = Compensation Earning Service, employeeId, period)
 ├─ Basic Pay
 ├─ Allowances[]      (e.g. housing, transport — each named + amount)
 ├─ Deductions[]       (statutory: NSSF, WCF, PAYE tax — rates configurable per-org)
 └─ Net Pay            (computed: Basic + Allowances − Deductions)
```
Feeds Budget as an Expense against Compensation Earning Service once a pay run is finalized (routes through Anne like any other spend), so it's visible in the spend picture without losing its own identity as a service with an owner, findings, and workload.

**Worth flagging, not a blocker:** giving Jennifer ownership of Compensation Earning Service deepens the existing Finding 2 (provider concentration) — she now runs three of five enabling services, one of which (Compensation) underlies pay for every provider in the org. `vbp-internal-service-architecture.md` has been updated to reflect this explicitly (Finding 2 and 3 text revised 2026-09-15). Not something to fix in the data model — just something the findings tracking should keep surfacing rather than quietly absorb.

## 8. Data model — how everything wires together

```
Organization (tenant)
 └─ User (org_id, role(s) — each role scoped to a serviceId, except Org Admin/Viewer/Budget Approver which are org-wide)
 └─ Service (org_id, type: CVS|Enabling, provider, backup, dependsOn[], feeds[], technology, outcome)
     └─ Task              (serviceId, assignee, status, dependencies[])
     └─ ServiceRequest    (serviceId, requester, type, priority, status)
     └─ Lead              (serviceId, contact, stage, owner)
     └─ BudgetRequest     (serviceId, initiator, source: petty_cash|direct, purpose, amount, status, approverId)
         └─ Quotation      (budgetRequestId, vendor, amount)
         └─ Expense        (serviceId, budgetRequestId nullable, amount, date, receipt)
             └─ Invoice     (expenseId nullable, direction: incoming|outgoing, party, amount, dueDate, status)
     └─ CompensationEntry (serviceId = Compensation Earning Service, employeeId, period, basicPay, allowances[], deductions[], netPay)
     └─ Class             (serviceId=Master Class Delivery, scheduledDate, instructor)
         └─ Task[]          (auto-generated on Class creation, each serviceId-tagged)
         └─ Invoice[]        (outgoing, billing the customer org for this class)
     └─ Finding            (serviceId nullable — some findings are cross-cutting, e.g. provider concentration)
 └─ Comment/Activity (entityType, entityId, author, body, mentions[]) — attaches to any of the above
```

Note `approverId` on BudgetRequest defaults to the org's Budget Approver (Anne at VBP) rather than being chosen per-request, since that role is org-wide.

## 9. Multi-tenancy architecture — CONFIRMED

Shared database, `org_id` row-level scoping, enforced with Postgres Row-Level Security.

## 10. Authentication — CONFIRMED

Supabase Auth + Supabase Postgres. RLS policies reference `auth.uid()` directly.

## 11. Build order — CONFIRMED

1. **Foundation** — multi-tenant data model (`org_id` + RLS), Supabase Auth, design system core tokens/components, visible version badge, PWA shell (Section 12).
2. **Processes (Tasks)**
3. **Pipeline (Leads)**
4. **Classes**
5. **Budget + Compensation Earning Service** — grouped together since Compensation feeds Budget and both need the Budget Approver role live.
6. **Service Requests + Collaboration**
7. **Capabilities/Workload + Outcomes metrics**

## 12. Non-functional requirements

- **Code quality** — clean, readable, human-written-feeling code, no long files, split by responsibility. (Also captured in project preferences for this session.)
- **Workflow validation** — each module's use case actually tested against a real scenario before being called done (e.g. Compensation: a pay period actually computes Net Pay correctly for a sample employee under Tanzania's NSSF/WCF/PAYE rules).
- **API connector** — production-ready API-key-based integration, designed after foundation-phase auth is in place.
- **UI/UX** — premium Microsoft/Apple-inspired direction, explicit task visibility.
- **Mobile & responsive** — fully responsive, not desktop-first.
- **PWA** — installable, offline-capable shell.

## 13. Status

Everything above is now confirmed. No open decisions remain for this alignment pass. Next step is the foundation phase (Section 11, item 1) — multi-tenant schema, Supabase Auth, design system tokens, PWA shell — before any feature module work begins.
