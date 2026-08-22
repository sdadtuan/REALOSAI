import { BadRequestException } from '@nestjs/common';
import { LeadCreateEnrichmentService } from './lead-create-enrichment.service';
import { AppConfigService } from '../../config/app-config.service';

describe('LeadCreateEnrichmentService B2B gate', () => {
  const dedup = {
    findByExternalId: jest.fn(async () => null),
    findContactDuplicates: jest.fn(async () => []),
  };
  const rulesRepo = {
    fetchClientIndustry: jest.fn(async () => null),
    fetchSnapshot: jest.fn(async () => null),
  };
  const autoAssign = { assignOwner: jest.fn(async () => null) };
  const b2bFirstAssign = { assign: jest.fn(async () => ({ ownerId: null, strategy: 'hybrid', reason: 'empty', confidence: null })) };

  it('B2B-01 missing project when flag on', async () => {
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedup as never,
      rulesRepo as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );
    await expect(svc.enrich({ full_name: 'Test', lead_flow_kind: 'b2b_prospect' })).rejects.toEqual(
      new BadRequestException({ error: 'b2b_project_required' }),
    );
  });

  it('sets PTT owner company when project provided', async () => {
    const appConfig = { b2bProjectOs: true } as AppConfigService;
    const svc = new LeadCreateEnrichmentService(
      dedup as never,
      rulesRepo as never,
      autoAssign as never,
      b2bFirstAssign as never,
      appConfig,
    );
    const out = await svc.enrich({
      full_name: 'Test',
      lead_flow_kind: 'b2b_prospect',
      b2b_project_id: 'proj-1',
    });
    expect(out.owner_company_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(out.client_id).toBeNull();
    expect(out.b2b_project_id).toBe('proj-1');
  });
});
