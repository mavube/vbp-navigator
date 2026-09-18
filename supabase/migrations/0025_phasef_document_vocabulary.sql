-- Phase F (portfolio correction, Track 2) — renames the
-- 'admission_communication' document type to 'welcome_communication',
-- consistent with the same correction already applied to lead-stage
-- vocabulary in Phase D (0024_phased_pipeline_vocabulary.sql) and the
-- schema anchor in Phase C (0023_phasec_product_service_anchor.sql).
-- "Admission" is PMP's own Candidate Admission CVS language; nothing
-- about this document type is specific to PMP or to any formal
-- admission step — it's the generic "you're all set, here's what's
-- next" letter sent once an Engagement exists, whatever the service.
--
-- The other seven doc_types (proposal, quotation, invoice, invitation,
-- approval_request, confirmation, completion_record) are untouched.
--
-- Diallo has already deployed through at least Phase 16, and Phases
-- C/D/E have presumably also been applied or are about to be — real
-- documents of type 'admission_communication' may already exist, so
-- this updates existing rows in place rather than assuming a clean
-- slate. Order matters: drop the existing check constraint before the
-- UPDATE, then re-add it with the new value list, mirroring
-- 0024_phased_pipeline_vocabulary.sql's structure exactly.
--
-- The app's own template/anchor logic (lib/document-templates.ts,
-- lib/document-context.ts) is unaffected by data already in the table —
-- it keys off the doc_type value going forward, and
-- app/api/documents/route.ts's VALID_TYPES now lists
-- 'welcome_communication' instead of 'admission_communication'.

alter table documents drop constraint if exists documents_doc_type_check;

update documents set doc_type = 'welcome_communication' where doc_type = 'admission_communication';

alter table documents add constraint documents_doc_type_check check (doc_type in (
  'proposal', 'quotation', 'invoice', 'invitation', 'approval_request',
  'confirmation', 'welcome_communication', 'completion_record'
));
