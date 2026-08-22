import { planLeadArrivalAlerts } from './b2b-alert.util';

describe('planLeadArrivalAlerts', () => {
  const project = 'p1';
  const lead = { flowKind: 'b2b_prospect' as const, ownerId: 10, projectId: project, score: 80 };

  it('B2B-16 hot assigned → urgent to owner', () => {
    const out = planLeadArrivalAlerts({
      lead,
      inHours: true,
      receivers: [
        { staffId: 10, assignEnabled: true, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true },
      ],
    });
    expect(out).toEqual([{ staffId: 10, severity: 'urgent', kind: 'assigned_hot' }]);
  });

  it('B2B-17 outsider gets none', () => {
    const out = planLeadArrivalAlerts({
      lead,
      inHours: true,
      receivers: [
        { staffId: 99, assignEnabled: false, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true },
      ],
    });
    expect(out).toEqual([]);
  });

  it('unassigned → inbox to assign_enabled members', () => {
    const out = planLeadArrivalAlerts({
      lead: { ...lead, ownerId: null, score: 40 },
      inHours: true,
      receivers: [
        { staffId: 10, assignEnabled: true, isDirector: false, hasViewAllLeads: false, isActivePttStaff: true },
      ],
    });
    expect(out[0]).toMatchObject({ staffId: 10, severity: 'inbox', kind: 'unassigned' });
  });
});
