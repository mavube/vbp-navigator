-- Phase 5: Document Generation Engine (v3.0 roadmap, §8 completed).
--
-- Templated document generation — proposal, quotation, invitation,
-- approval request, confirmation, admission communication, completion
-- record — tied to a Lead (pre-admission — a document can go out before
-- someone becomes a real Customer, e.g. a proposal or quotation) or an
-- Engagement (post-admission — confirmation, admission communication,
-- completion record). Exactly one of lead_id/engagement_id is required;
-- customer_id is only ever set alongside engagement_id, since Customer
-- doesn't exist until admission (v3.0 Phase 4). Templates themselves
-- are code (lib/document-templates.ts), not a database-editable
-- template system — no one asked for a template editor, and building
-- one would be scope this phase doesn't need.
--
-- "Versioned" here means: while a document is still 'draft' it can be
-- regenerated in place (same row, same version); once 'approved' it's
-- immutable, and creating a new version inserts a fresh row (version =
-- previous + 1, previous_version_id set) rather than mutating history.

create table if not exists documents (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations (id) on delete cascade,
  service_id            uuid not null references services (id) on delete cascade,
  lead_id               uuid references leads (id) on delete set null,
  engagement_id         uuid references engagements (id) on delete set null,
  customer_id           uuid references customers (id) on delete set null,
  doc_type              text not null check (doc_type in (
                           'proposal', 'quotation', 'invitation', 'approval_request',
                           'confirmation', 'admission_communication', 'completion_record'
                         )),
  title                 text not null,
  body                  text not null,
  details               text not null default '',
  recipient_name        text not null default '',
  recipient_email       text not null default '',
  status                text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected')),
  version               integer not null default 1,
  previous_version_id   uuid references documents (id) on delete set null,
  sent_at               timestamptz,
  created_by_name       text not null default '',
  approved_by_name      text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint documents_anchor_check check (lead_id is not null or engagement_id is not null)
);
create index if not exists documents_org_id_idx on documents (org_id);
create index if not exists documents_service_id_idx on documents (service_id);
create index if not exists documents_lead_id_idx on documents (lead_id);
create index if not exists documents_engagement_id_idx on documents (engagement_id);

alter table documents enable row level security;

-- Same visibility as everything else — org-wide select. Creating and
-- regenerating a draft needs to manage the document's service (same
-- gate as recording an Expense — a document is a real outward-facing
-- artifact, not an open-creation item like a Task); approving/rejecting
-- is the org-wide Budget Approver or an Org Admin, same authority as
-- approving a Budget Request or finalizing Compensation (see
-- lib/permissions.ts's canApproveBudget — reused rather than inventing
-- a new "document approver" role for the same real person).
create policy documents_select on documents
  for select using (org_id = current_org_id());
create policy documents_insert on documents
  for insert with check (
    org_id = current_org_id()
    and (has_role('org_admin') or has_role('service_owner', service_id) or has_role('contributor', service_id))
  );
create policy documents_update on documents
  for update using (
    org_id = current_org_id()
    and (
      has_role('org_admin')
      or has_role('service_owner', service_id)
      or has_role('contributor', service_id)
      or has_role('budget_approver')
    )
  );
