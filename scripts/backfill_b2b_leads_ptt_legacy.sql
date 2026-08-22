UPDATE crm_leads l
SET owner_company_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    b2b_project_id = (SELECT id FROM crm_b2b_projects WHERE code = 'PTT-LEGACY')
WHERE l.agency_client_id IS NULL
  AND l.b2b_project_id IS NULL;
