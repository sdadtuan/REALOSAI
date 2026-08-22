import { NotFoundException } from '@nestjs/common';
import { BdsBuyerLeadScopeService } from './bds-buyer-lead-scope.service';

describe('BdsBuyerLeadScopeService', () => {
  it('agency not owner → 404', async () => {
    const leadRepo = { isProjectStaff: jest.fn() };
    const scope = new BdsBuyerLeadScopeService(leadRepo as never);
    await expect(
      scope.assertVisible({
        lead: {
          id: 1,
          full_name: '',
          phone: '',
          email: '',
          status: 'moi',
          re_project_id: 12,
          tenant_id: 't1',
          owner_id: null,
          channel_partner_id: 'a1',
          meta_json: { lead_flow_kind: 're_buyer', channel_partner_id: 'a1' },
          created_at: null,
          received_at: null,
        },
        agencyId: 'a2',
        staffId: 9,
      }),
    ).rejects.toMatchObject({ response: { error: 'not_found' } });
  });

  it('project staff can see lead', async () => {
    const leadRepo = { isProjectStaff: jest.fn().mockResolvedValue(true) };
    const scope = new BdsBuyerLeadScopeService(leadRepo as never);
    await expect(
      scope.assertVisible({
        lead: {
          id: 1,
          full_name: '',
          phone: '',
          email: '',
          status: 'moi',
          re_project_id: 12,
          tenant_id: 't1',
          owner_id: null,
          channel_partner_id: null,
          meta_json: { lead_flow_kind: 're_buyer' },
          created_at: null,
          received_at: null,
        },
        staffId: 5,
      }),
    ).resolves.toBeUndefined();
  });

  it('non-member staff → 404', async () => {
    const leadRepo = { isProjectStaff: jest.fn().mockResolvedValue(false) };
    const scope = new BdsBuyerLeadScopeService(leadRepo as never);
    await expect(
      scope.assertVisible({
        lead: {
          id: 1,
          full_name: '',
          phone: '',
          email: '',
          status: 'moi',
          re_project_id: 12,
          tenant_id: 't1',
          owner_id: null,
          channel_partner_id: null,
          meta_json: { lead_flow_kind: 're_buyer' },
          created_at: null,
          received_at: null,
        },
        staffId: 9,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
