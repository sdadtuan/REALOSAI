import { B2bAlertsService } from './b2b-alerts.service';

describe('B2bAlertsService', () => {
  it('B2B-17 does not insert for outsider', async () => {
    const repo = { insertAlerts: jest.fn() };
    const push = { send: jest.fn() };
    const svc = new B2bAlertsService(repo as never, push as never);
    await svc.fanoutArrival({
      lead: { flowKind: 'b2b_prospect', ownerId: 10, projectId: 'p', score: 80, leadId: 1 },
      inHours: true,
      receivers: [
        {
          staffId: 99,
          assignEnabled: false,
          isDirector: false,
          hasViewAllLeads: false,
          isActivePttStaff: true,
        },
      ],
    });
    expect(repo.insertAlerts).toHaveBeenCalledWith([]);
    expect(push.send).not.toHaveBeenCalled();
  });

  it('B2B-16 inserts urgent alert for hot owner', async () => {
    const repo = { insertAlerts: jest.fn() };
    const push = { send: jest.fn() };
    const svc = new B2bAlertsService(repo as never, push as never);
    await svc.fanoutArrival({
      lead: { flowKind: 'b2b_prospect', ownerId: 10, projectId: 'p', score: 80, leadId: 2 },
      inHours: true,
      receivers: [
        {
          staffId: 10,
          assignEnabled: true,
          isDirector: false,
          hasViewAllLeads: false,
          isActivePttStaff: true,
        },
      ],
    });
    expect(repo.insertAlerts).toHaveBeenCalledWith([
      { leadId: 2, staffId: 10, severity: 'urgent', kind: 'assigned_hot' },
    ]);
    expect(push.send).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 10, severity: 'urgent' }),
    );
  });
});
