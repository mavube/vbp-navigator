-- Phase D (portfolio correction, Track 2) — replaces the PMP-specific
-- lead-stage vocabulary ('assessed', 'admitted') with generic pipeline
-- vocabulary ('qualified', 'won'), consistent with the same correction
-- already applied to the schema anchor in Phase C
-- (0023_phasec_product_service_anchor.sql). 'new', 'contacted', and
-- 'lost' were already generic and are untouched.
--
-- Diallo has already deployed Phase 16 and (per the sequencing) Phase
-- C ahead of this one, so real rows may already exist under the old
-- stage names — this migration updates them in place rather than
-- assuming a clean slate. Order matters: the existing check constraint
-- must be dropped before the UPDATE (it would otherwise reject nothing
-- here, since we're moving old values in, not out — but it's still
-- correct to drop-then-update-then-add so the new constraint is the
-- one actually enforced going forward).
--
-- The app's own admission-conversion logic (lib/db-engagements.ts's
-- convertLead, formerly admitLead) is unaffected — it keys off the
-- stage value, not its old English label, and app/api/leads/[id]/
-- route.ts now checks for 'won' instead of 'admitted'.

alter table leads drop constraint if exists leads_stage_check;

update leads set stage = 'qualified' where stage = 'assessed';
update leads set stage = 'won' where stage = 'admitted';

alter table leads add constraint leads_stage_check
  check (stage in ('new', 'contacted', 'qualified', 'won', 'lost'));
