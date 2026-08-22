import { BdsBuyerVisitService } from './bds-buyer-visit.service';

describe('BdsBuyerVisitService', () => {
  it('create visit + status xem_nha', async () => {
    const leadRepo = {
      getLeadForScope: jest.fn().mockResolvedValue({
        id: 1,
        status: 'da_lien_he',
        tenant_id: 't1',
        meta_json: { lead_flow_kind: 're_buyer' },
      }),
      setLeadStatus: jest.fn(),
    };
    const buyerRepo = {
      insertVisit: jest.fn().mockResolvedValue({
        id: 'v1',
        lead_id: 1,
        outcome: 'planned',
      }),
    };
    const scope = { assertVisible: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsBuyerVisitService(
      leadRepo as never,
      buyerRepo as never,
      scope as never,
    );
    await svc.createVisit(
      1,
      { scheduled_at: '2026-08-22T10:00:00Z', staff_id: 5 },
      't1',
    );
    expect(buyerRepo.insertVisit).toHaveBeenCalled();
    expect(leadRepo.setLeadStatus).toHaveBeenCalledWith(1, 'xem_nha');
  });
});
