import { readFileSync } from 'fs';
import { join } from 'path';

describe('PTT_B2B_PROJECT_OS', () => {
  it('defaults off', () => {
    const raw = (process.env.PTT_B2B_PROJECT_OS ?? '0').trim().toLowerCase();
    const on = ['1', 'true', 'yes', 'on'].includes(raw);
    expect(on).toBe(false);
  });
});

describe('b2b ddl', () => {
  it('seeds PTT company and PTT-LEGACY', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../docs/specs/2026-08-18-postgresql-ddl-b2b-lead-project-os.sql'),
      'utf8',
    );
    expect(sql).toContain('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(sql).toContain('PTT-LEGACY');
    expect(sql).toContain('crm_b2b_project_pages');
    expect(sql).toContain('crm_b2b_lead_alerts');
  });
});
