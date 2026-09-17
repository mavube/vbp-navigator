-- Phase 8.5: Quick Wins (post-Phase-8 enhancement backlog, Cluster A).
--
-- One additive column, no rewrite of anything existing:
--
-- `budget_requests.needed_by` — the "no due-date/needed-by field" gap
-- named in the audit behind this phase. Nullable, same discipline as
-- every other optional date column in this schema (tasks.due_date,
-- tasks.start_date, invoices.due_date) — a request with no deadline
-- still works fine, it just won't be flagged as time-sensitive.
--
-- Safe to use a real `date` type here (unlike being tempted to store
-- it as text): lib/db-driver.ts now registers a Postgres type parser
-- for the `date` OID that returns it as a plain "YYYY-MM-DD" string,
-- the same fix that resolved the Gantt/Calendar "Invalid Date" bug —
-- so every date column, this one included, behaves identically across
-- the SQLite (dev) and Postgres (prod) drivers.

alter table budget_requests add column if not exists needed_by date;
