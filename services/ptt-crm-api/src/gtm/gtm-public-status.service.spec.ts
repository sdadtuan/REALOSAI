import { GtmPublicStatusService } from './gtm-public-status.service';

describe('GtmPublicStatusService', () => {
  it('returns status shape without secrets', async () => {
    const repo = {
      pingDb: jest.fn().mockResolvedValue(true),
      pingCmsTable: jest.fn().mockResolvedValue(true),
    };
    const svc = new GtmPublicStatusService(repo as never);
    const out = await svc.getPublicStatus();

    expect(out.sla_target_pct).toBe(99.9);
    expect(out.components.map((c) => c.id).sort()).toEqual(['cms_read', 'demo_api', 'marketing_site']);
    expect(JSON.stringify(out)).not.toMatch(/password|secret|postgresql/i);
    expect(out.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('marks demo_api outage when db ping fails', async () => {
    const repo = {
      pingDb: jest.fn().mockResolvedValue(false),
      pingCmsTable: jest.fn().mockResolvedValue(false),
    };
    const svc = new GtmPublicStatusService(repo as never);
    const out = await svc.getPublicStatus();

    expect(out.components.find((c) => c.id === 'demo_api')?.status).toBe('outage');
  });
});
