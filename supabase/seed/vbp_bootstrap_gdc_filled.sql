-- VBP Navigator OS — full production bootstrap for the GDC Consulting
-- org: organization, the 5 people's profiles, the real 10-service
-- catalog, and everyone's role assignments — in the one order that
-- actually satisfies the foreign keys (profiles need auth users to
-- already exist; services need profiles to exist for provider_id;
-- service-scoped role_assignments need services to exist).
--
-- HOW TO USE
-- 1. In the Supabase dashboard: Authentication -> Users -> Add user,
--    once for each person below (email + a password you set). Supabase
--    shows you each new user's id (a uuid) right after creating it —
--    copy all 5.
-- 2. In this file, find-and-replace each of the 5 placeholders below
--    with the matching auth user id you just copied:
--      d5156765-e28e-44bf-a056-ea028ea5865d    (it@gdc.co.tz)
--      70479535-16fe-41ee-b822-3e49bf0f2c03      (anne@gdc.co.tz)
--      c43f2139-b861-4558-8a1b-8011fa9ffa89  (sdm@gdc.co.tz)
--      7ff45ae3-3b6a-4eca-8155-5c4a76e4b635     (twesa@gdc.co.tz)
--      80c96574-06c9-4157-8fae-8ff81dd6119a     (edwin@gdc.co.tz)
-- 3. Paste the whole file into the Supabase SQL Editor and run it once,
--    top to bottom. (Only after the 10 migrations in
--    supabase/migrations/ have already been run against this project —
--    see README "v2.0 Foundation setup" steps 1-3.)
--
-- The organization id below is a fixed, already-generated uuid (not
-- gen_random_uuid()) specifically so every insert in this file — and
-- any later reference to "VBP's org id" — can use the same literal
-- without you having to copy a generated id between statements.

-- ---------------------------------------------------------- 1. org
insert into organizations (id, name, slug)
values ('6bd4d95e-271d-460d-8df0-16d49697c9f8', 'VBP (GDC Consulting)', 'vbp');

-- ---------------------------------------------------------- 2. profiles
insert into profiles (id, org_id, full_name, email) values
  ('d5156765-e28e-44bf-a056-ea028ea5865d',   '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'Diallo',   'it@gdc.co.tz'),
  ('70479535-16fe-41ee-b822-3e49bf0f2c03',     '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'Anne',     'anne@gdc.co.tz'),
  ('c43f2139-b861-4558-8a1b-8011fa9ffa89', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'Jennifer', 'sdm@gdc.co.tz'),
  ('7ff45ae3-3b6a-4eca-8155-5c4a76e4b635',    '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'Twesa',    'twesa@gdc.co.tz'),
  ('80c96574-06c9-4157-8fae-8ff81dd6119a',    '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'Edwin',    'edwin@gdc.co.tz');

-- ---------------------------------------------------------- 3. services
-- VBP's real 5 CVS + 5 Enabling catalog (see
-- claude/vbp-internal-service-architecture.md). Same fixed service ids
-- used by supabase/seed/vbp_services.sql, so depends_on/feeds can
-- reference each other within this one script.
insert into services (id, org_id, type, name, department, provider_id, depends_on, feeds) values
  ('594b165a-158f-43e8-839a-43b57a7c88c0', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'cvs', 'Professional Readiness Assessment', '',
    null, -- gap: not evidenced, no owner
    array['f90e28bb-a36b-4f4f-a708-778715b744ba']::uuid[],
    array['f25b7da5-56ce-48c1-abfd-c267402800b9']::uuid[]),

  ('f25b7da5-56ce-48c1-abfd-c267402800b9', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'cvs', 'Candidate Admission', '',
    null, -- gap: no single owner
    array['f90e28bb-a36b-4f4f-a708-778715b744ba','594b165a-158f-43e8-839a-43b57a7c88c0']::uuid[],
    array['772c2649-e429-4321-9272-30d5517274a0']::uuid[]),

  ('772c2649-e429-4321-9272-30d5517274a0', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'cvs', 'Master Class Delivery', 'Instructor',
    '70479535-16fe-41ee-b822-3e49bf0f2c03',
    array['fe742ab7-4ea8-4b79-b813-ec64ee6db5c9','5213347c-5db0-4e35-9f2f-3aae3a2b0862','f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac']::uuid[],
    array['60e902ce-a53a-4af6-ab47-036b16953f29']::uuid[]),

  ('60e902ce-a53a-4af6-ab47-036b16953f29', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'cvs', 'Post-Training Certification Support', 'Instructor',
    '70479535-16fe-41ee-b822-3e49bf0f2c03',
    array['fe742ab7-4ea8-4b79-b813-ec64ee6db5c9']::uuid[],
    array['9f6eb451-d5d3-4abc-a690-fdee2704f441']::uuid[]),

  ('9f6eb451-d5d3-4abc-a690-fdee2704f441', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'cvs', 'Certification / Completion Fulfillment', 'IT',
    '80c96574-06c9-4157-8fae-8ff81dd6119a',
    array['fe742ab7-4ea8-4b79-b813-ec64ee6db5c9']::uuid[],
    array[]::uuid[]),

  ('f90e28bb-a36b-4f4f-a708-778715b744ba', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'enabling', 'Demand & Engagement', 'IT',
    '80c96574-06c9-4157-8fae-8ff81dd6119a',
    array[]::uuid[],
    array['594b165a-158f-43e8-839a-43b57a7c88c0','f25b7da5-56ce-48c1-abfd-c267402800b9']::uuid[]),

  ('fe742ab7-4ea8-4b79-b813-ec64ee6db5c9', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'enabling', 'Service Delivery Management', 'SDM',
    'c43f2139-b861-4558-8a1b-8011fa9ffa89',
    array[]::uuid[],
    array['f25b7da5-56ce-48c1-abfd-c267402800b9','772c2649-e429-4321-9272-30d5517274a0','60e902ce-a53a-4af6-ab47-036b16953f29','9f6eb451-d5d3-4abc-a690-fdee2704f441']::uuid[]),

  ('f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'enabling', 'Financial & Commercial Administration', 'SDM / Instructor',
    'c43f2139-b861-4558-8a1b-8011fa9ffa89', -- tracks; Anne approves via the org-wide budget_approver role, not this column
    array[]::uuid[],
    array['772c2649-e429-4321-9272-30d5517274a0']::uuid[]),

  ('5213347c-5db0-4e35-9f2f-3aae3a2b0862', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'enabling', 'Operational Support', 'Kitchen',
    '7ff45ae3-3b6a-4eca-8155-5c4a76e4b635',
    array[]::uuid[],
    array['772c2649-e429-4321-9272-30d5517274a0']::uuid[]),

  ('60f51f34-6b3b-4097-b5ac-b57665939caf', '6bd4d95e-271d-460d-8df0-16d49697c9f8', 'enabling', 'Compensation Earning Service', 'SDM / Instructor',
    'c43f2139-b861-4558-8a1b-8011fa9ffa89', -- runs; Anne approves via the org-wide budget_approver role, not this column
    array[]::uuid[],
    array['594b165a-158f-43e8-839a-43b57a7c88c0','f25b7da5-56ce-48c1-abfd-c267402800b9','772c2649-e429-4321-9272-30d5517274a0','60e902ce-a53a-4af6-ab47-036b16953f29','9f6eb451-d5d3-4abc-a690-fdee2704f441','f90e28bb-a36b-4f4f-a708-778715b744ba','fe742ab7-4ea8-4b79-b813-ec64ee6db5c9','f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac','5213347c-5db0-4e35-9f2f-3aae3a2b0862']::uuid[]);

-- ---------------------------------------------------------- 4. roles
-- Diallo — Org Admin (org-wide, service_id null).
insert into role_assignments (org_id, user_id, service_id, role) values
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', 'd5156765-e28e-44bf-a056-ea028ea5865d', null, 'org_admin');

-- Anne — Service Owner on her two CVS, plus the org-wide Budget
-- Approver role (confirmed org-wide, not per-service — alignment doc
-- Section 4 — she's the sign-off for every budget request/compensation
-- finalize across the whole org, not just her own services).
insert into role_assignments (org_id, user_id, service_id, role) values
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', '70479535-16fe-41ee-b822-3e49bf0f2c03', '772c2649-e429-4321-9272-30d5517274a0', 'service_owner'), -- Master Class Delivery
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', '70479535-16fe-41ee-b822-3e49bf0f2c03', '60e902ce-a53a-4af6-ab47-036b16953f29', 'service_owner'), -- Post-Training Certification Support
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', '70479535-16fe-41ee-b822-3e49bf0f2c03', null, 'budget_approver');

-- Jennifer — Service Owner on Service Delivery Management, Financial &
-- Commercial Administration, and Compensation Earning Service (she runs
-- the monthly compensation process).
insert into role_assignments (org_id, user_id, service_id, role) values
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', 'c43f2139-b861-4558-8a1b-8011fa9ffa89', 'fe742ab7-4ea8-4b79-b813-ec64ee6db5c9', 'service_owner'), -- Service Delivery Management
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', 'c43f2139-b861-4558-8a1b-8011fa9ffa89', 'f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac', 'service_owner'), -- Financial & Commercial Administration
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', 'c43f2139-b861-4558-8a1b-8011fa9ffa89', '60f51f34-6b3b-4097-b5ac-b57665939caf', 'service_owner'); -- Compensation Earning Service

-- Edwin — Service Owner on Demand & Engagement and Certification /
-- Completion Fulfillment.
insert into role_assignments (org_id, user_id, service_id, role) values
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', '80c96574-06c9-4157-8fae-8ff81dd6119a', 'f90e28bb-a36b-4f4f-a708-778715b744ba', 'service_owner'), -- Demand & Engagement
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', '80c96574-06c9-4157-8fae-8ff81dd6119a', '9f6eb451-d5d3-4abc-a690-fdee2704f441', 'service_owner'); -- Certification / Completion Fulfillment

-- Twesa — Service Owner on Operational Support.
insert into role_assignments (org_id, user_id, service_id, role) values
  ('6bd4d95e-271d-460d-8df0-16d49697c9f8', '7ff45ae3-3b6a-4eca-8155-5c4a76e4b635', '5213347c-5db0-4e35-9f2f-3aae3a2b0862', 'service_owner'); -- Operational Support

-- Everyone implicitly has "Requester" (submit tasks/tickets/budget
-- requests) — that's the default-open-to-anyone behavior the API
-- routes already enforce (see lib/permissions.ts), not a role row to
-- insert. No explicit `requester` or `contributor` assignments needed
-- unless/until specific named backups are added later (Findings 2/3).

-- ---------------------------------------------------------- done
-- Verify: select p.full_name, ra.role, s.name as service
--   from role_assignments ra
--   join profiles p on p.id = ra.user_id
--   left join services s on s.id = ra.service_id
--   where ra.org_id = '6bd4d95e-271d-460d-8df0-16d49697c9f8'
--   order by p.full_name;
