import { BadRequestException } from '@nestjs/common';
import { BdsBuyerLeadService } from './bds-buyer-lead.service';

describe('BdsBuyerLeadService', () => {
  function make() {
    const leadRepo = {
      getLeadForScope: jest.fn(),
      patchLeadMeta: jest.fn(),
      setLeadStatus: jest.fn(),
      findReBuyerByPhoneProject: jest.fn(),
      createLead: jest.fn(),
      listByProject: jest.fn(),
    };
    const buyerRepo = { upsertBuyer: jest.fn() };
    const scope = { assertVisible: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsBuyerLeadService(
      leadRepo as never,
      buyerRepo as never,
      scope as never,
    );
    return { svc, leadRepo, buyerRepo, scope };
  }

  it('qualify creates bds_buyers and links lead', async () => {
    const { svc, leadRepo, buyerRepo } = make();
    leadRepo.getLeadForScope.mockResolvedValue({
      id: 1,
      status: 'moi',
      phone: '84901234567',
      full_name: 'A',
      email: '',
      re_project_id: 12,
      tenant_id: 't1',
      meta_json: { lead_flow_kind: 're_buyer' },
    });
    buyerRepo.upsertBuyer.mockResolvedValue({ id: 'b1' });
    leadRepo.getLeadForScope
      .mockResolvedValueOnce({
        id: 1,
        status: 'moi',
        phone: '84901234567',
        full_name: 'A',
        email: '',
        re_project_id: 12,
        tenant_id: 't1',
        meta_json: { lead_flow_kind: 're_buyer' },
      })
      .mockResolvedValueOnce({
        id: 1,
        status: 'da_lien_he',
        phone: '84901234567',
        full_name: 'A',
        email: '',
        re_project_id: 12,
        tenant_id: 't1',
        meta_json: { lead_flow_kind: 're_buyer', buyer_id: 'b1' },
      });
    await svc.qualify(1, { status: 'da_lien_he' }, 't1');
    expect(buyerRepo.upsertBuyer).toHaveBeenCalled();
    expect(leadRepo.patchLeadMeta).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ buyer_id: 'b1' }),
    );
  });

  it('create rejects duplicate phone in same project', async () => {
    const { svc, leadRepo } = make();
    leadRepo.findReBuyerByPhoneProject.mockResolvedValue({ lead_id: 9 });
    await expect(
      svc.create(
        { full_name: 'A', phone: '84901234567', re_project_id: 12 },
        't1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('syncHoldActive sets giu_cho for re_buyer', async () => {
    const { svc, leadRepo } = make();
    leadRepo.getLeadForScope.mockResolvedValue({
      id: 1,
      status: 'da_lien_he',
      meta_json: { lead_flow_kind: 're_buyer' },
    });
    await svc.syncHoldActive(1);
    expect(leadRepo.setLeadStatus).toHaveBeenCalledWith(1, 'giu_cho');
  });
});
