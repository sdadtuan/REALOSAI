import {
  buildPresalesConsultProposalSla,
  CONSULT_PROPOSAL_SLA_HOURS,
  isConsultToProposalWithin48h,
} from './presales-consult-sla.util';

describe('presales-consult-sla.util', () => {
  const now = new Date('2026-08-05T12:00:00Z');

  it('returns na when not in consult stage', () => {
    const sla = buildPresalesConsultProposalSla({
      presalesStage: 'lead',
      consultEnteredAt: '2026-08-04 10:00:00',
      stageEnteredAt: '2026-08-04 10:00:00',
      now,
    });
    expect(sla.sla_state).toBe('na');
  });

  it('breaches after 48h in consult', () => {
    const started = new Date(now.getTime() - (CONSULT_PROPOSAL_SLA_HOURS + 2) * 3_600_000);
    const sla = buildPresalesConsultProposalSla({
      presalesStage: 'consult',
      consultEnteredAt: started.toISOString(),
      stageEnteredAt: started.toISOString(),
      now,
    });
    expect(sla.sla_state).toBe('breach');
  });

  it('warns within last 12h', () => {
    const started = new Date(now.getTime() - 40 * 3_600_000);
    const sla = buildPresalesConsultProposalSla({
      presalesStage: 'consult',
      consultEnteredAt: started.toISOString(),
      stageEnteredAt: started.toISOString(),
      now,
    });
    expect(sla.sla_state).toBe('warning');
  });

  it('measures 48h compliance for completed handoff', () => {
    expect(
      isConsultToProposalWithin48h('2026-08-01 10:00:00', '2026-08-02 09:00:00'),
    ).toBe(true);
    expect(
      isConsultToProposalWithin48h('2026-08-01 10:00:00', '2026-08-04 10:00:00'),
    ).toBe(false);
  });
});
