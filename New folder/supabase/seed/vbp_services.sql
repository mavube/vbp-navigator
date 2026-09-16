-- Seeds VBP's real service catalog (5 CVS + 5 Enabling, per
-- vbp-internal-service-architecture.md) into the `services` table.
--
-- Run this AFTER the org + profiles/role_assignments bootstrap in the
-- README ("v2.0 Foundation setup", step 4) — provider_id below needs
-- real profiles.id values, which only exist once each person has signed
-- up. Find-and-replace every <...> placeholder before running.
--
-- Service ids are fixed literals (not gen_random_uuid()) so depends_on/
-- feeds can reference each other within this one script.

-- Replace with the org id from the README bootstrap step.
-- (Every insert below uses it — search-and-replace once.)
--   <VBP_ORG_ID>

insert into services (id, org_id, type, name, department, provider_id, depends_on, feeds) values
  ('594b165a-158f-43e8-839a-43b57a7c88c0', '<VBP_ORG_ID>', 'cvs', 'Professional Readiness Assessment', '',
    null, -- gap: not evidenced, no owner (see Finding — Section 1)
    array['f90e28bb-a36b-4f4f-a708-778715b744ba']::uuid[],
    array['f25b7da5-56ce-48c1-abfd-c267402800b9']::uuid[]),

  ('f25b7da5-56ce-48c1-abfd-c267402800b9', '<VBP_ORG_ID>', 'cvs', 'Candidate Admission', '',
    null, -- gap: no single owner (Finding 4)
    array['f90e28bb-a36b-4f4f-a708-778715b744ba','594b165a-158f-43e8-839a-43b57a7c88c0']::uuid[],
    array['772c2649-e429-4321-9272-30d5517274a0']::uuid[]),

  ('772c2649-e429-4321-9272-30d5517274a0', '<VBP_ORG_ID>', 'cvs', 'Master Class Delivery', 'Instructor',
    '<ANNE_PROFILE_ID>',
    array['fe742ab7-4ea8-4b79-b813-ec64ee6db5c9','5213347c-5db0-4e35-9f2f-3aae3a2b0862','f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac']::uuid[],
    array['60e902ce-a53a-4af6-ab47-036b16953f29']::uuid[]),

  ('60e902ce-a53a-4af6-ab47-036b16953f29', '<VBP_ORG_ID>', 'cvs', 'Post-Training Certification Support', 'Instructor',
    '<ANNE_PROFILE_ID>',
    array['fe742ab7-4ea8-4b79-b813-ec64ee6db5c9']::uuid[],
    array['9f6eb451-d5d3-4abc-a690-fdee2704f441']::uuid[]),

  ('9f6eb451-d5d3-4abc-a690-fdee2704f441', '<VBP_ORG_ID>', 'cvs', 'Certification / Completion Fulfillment', 'IT',
    '<EDWIN_PROFILE_ID>',
    array['fe742ab7-4ea8-4b79-b813-ec64ee6db5c9']::uuid[],
    array[]::uuid[]),

  ('f90e28bb-a36b-4f4f-a708-778715b744ba', '<VBP_ORG_ID>', 'enabling', 'Demand & Engagement', 'IT',
    '<EDWIN_PROFILE_ID>',
    array[]::uuid[],
    array['594b165a-158f-43e8-839a-43b57a7c88c0','f25b7da5-56ce-48c1-abfd-c267402800b9']::uuid[]),

  ('fe742ab7-4ea8-4b79-b813-ec64ee6db5c9', '<VBP_ORG_ID>', 'enabling', 'Service Delivery Management', 'SDM',
    '<JENNIFER_PROFILE_ID>',
    array[]::uuid[],
    array['f25b7da5-56ce-48c1-abfd-c267402800b9','772c2649-e429-4321-9272-30d5517274a0','60e902ce-a53a-4af6-ab47-036b16953f29','9f6eb451-d5d3-4abc-a690-fdee2704f441']::uuid[]),

  ('f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac', '<VBP_ORG_ID>', 'enabling', 'Financial & Commercial Administration', 'SDM / Instructor',
    '<JENNIFER_PROFILE_ID>', -- tracks; Anne approves via the org-wide budget_approver role, not this column
    array[]::uuid[],
    array['772c2649-e429-4321-9272-30d5517274a0']::uuid[]),

  ('5213347c-5db0-4e35-9f2f-3aae3a2b0862', '<VBP_ORG_ID>', 'enabling', 'Operational Support', 'Kitchen',
    '<TWESA_PROFILE_ID>',
    array[]::uuid[],
    array['772c2649-e429-4321-9272-30d5517274a0']::uuid[]),

  ('60f51f34-6b3b-4097-b5ac-b57665939caf', '<VBP_ORG_ID>', 'enabling', 'Compensation Earning Service', 'SDM / Instructor',
    '<JENNIFER_PROFILE_ID>', -- runs; Anne approves via the org-wide budget_approver role, not this column
    array[]::uuid[],
    -- underlies every provider in the org, not one CVS — feeds every other service
    array['594b165a-158f-43e8-839a-43b57a7c88c0','f25b7da5-56ce-48c1-abfd-c267402800b9','772c2649-e429-4321-9272-30d5517274a0','60e902ce-a53a-4af6-ab47-036b16953f29','9f6eb451-d5d3-4abc-a690-fdee2704f441','f90e28bb-a36b-4f4f-a708-778715b744ba','fe742ab7-4ea8-4b79-b813-ec64ee6db5c9','f0e2c4a0-6bb9-4f27-9a3b-660cb73482ac','5213347c-5db0-4e35-9f2f-3aae3a2b0862']::uuid[]);
