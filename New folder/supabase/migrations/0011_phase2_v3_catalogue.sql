-- v3.0 roadmap, Phase 2: Service Catalogue fields.
--
-- The `services` table already carries most of what a catalogue needs
-- (type, name, recipient, outcome, technology, department, provider_id,
-- backup_id, depends_on[], feeds[] — all from 0001_foundation_schema.sql).
-- This adds the handful of descriptive fields §4 of the v3.0 brief asks
-- for that don't exist yet. Deliberately NOT adding every field the
-- brief lists (configuration options, duration, required capabilities,
-- evidence, distinct preceding/succeeding-service suggestions) — those
-- are real future work, not this phase's scope; depends_on/feeds already
-- cover "dependencies" and "enabling services" per the existing model.
--
-- All nullable/defaulted so this is a safe additive change against a
-- database that already has real rows in it (VBP's live 10-service
-- catalog) — no backfill required, existing rows just read back with
-- empty strings until someone fills them in.

alter table services
  add column if not exists description text not null default '',
  add column if not exists customer_need text not null default '',
  add column if not exists target_customer text not null default '',
  add column if not exists delivery_model text not null default '',
  add column if not exists commercial_model text not null default '';
