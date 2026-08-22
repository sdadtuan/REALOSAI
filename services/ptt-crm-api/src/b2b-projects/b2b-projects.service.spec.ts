import { B2bProjectsService } from './b2b-projects.service';
import { PTT_OPERATING_COMPANY_ID } from './b2b-projects.constants';

describe('B2bProjectsService.create', () => {
  it('stamps owner_company_id PTT', async () => {
    const repo = {
      insertProject: jest.fn(async (row: { owner_company_id: string; code: string }) => ({
        id: 'new',
        ...row,
        name: 'SEO HN',
        status: 'draft',
        business_hours_json: {},
        sla_json: {},
        commission_json: { first_touch_pct: 30, closer_pct: 70 },
        ai_call_enabled: false,
        manual_ingest_enabled: true,
      })),
    };
    const svc = new B2bProjectsService(repo as never);
    const created = await svc.create({ code: 'seo-hn', name: 'SEO HN' });
    expect(repo.insertProject).toHaveBeenCalledWith(
      expect.objectContaining({ owner_company_id: PTT_OPERATING_COMPANY_ID, code: 'seo-hn' }),
    );
    expect(created.owner_company_id).toBe(PTT_OPERATING_COMPANY_ID);
  });
});
