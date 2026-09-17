-- v3.0 roadmap — Phase 11: Views & navigation (Cluster D).
--
-- One schema addition backing the whole cluster: a priority field on
-- Task. Everything else in Cluster D (Kanban drag-and-drop/filter/
-- group, Gantt swimlanes/drag-to-reschedule/zoom, Calendar click-to-
-- create/detail/class+blocker integration, Sidebar badges/collapse/
-- identity, and the brand-new Topbar) is UI and read-composition work
-- against tables that already exist — no other migration needed.

-- Task priority — the audit's own wording: "no priority field on Task
-- at all (so no color coding by urgency)". Four values, 'normal'
-- default so every existing task (created before this column existed)
-- reads as a plain, unremarkable priority rather than silently
-- becoming "low" or "urgent" by accident.
alter table tasks add column if not exists priority text not null default 'normal';
alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks add constraint tasks_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));
