import {
  computePresalesFunnelMetrics,
  isConsultToProposalWithin7d,
} from './presales-funnel-metrics.util';

describe('presales-funnel-metrics.util', () => {
  it('computes median go→consult and 7d/48h proposal rates', () => {
    const out = computePresalesFunnelMetrics({
      go_to_consult: [
        {
          intake_go_completed_at: '2026-08-01 10:00:00',
          consult_entered_at: '2026-08-02 10:00:00',
        },
        {
          intake_go_completed_at: '2026-08-01 10:00:00',
          consult_entered_at: '2026-08-03 10:00:00',
        },
      ],
      go_to_handoff: [
        {
          intake_go_completed_at: '2026-08-01 10:00:00',
          handed_off_at: '2026-08-01 20:00:00',
        },
        {
          intake_go_completed_at: '2026-08-01 10:00:00',
          handed_off_at: '2026-08-02 10:00:00',
        },
      ],
      handoff_to_release: [
        {
          handed_off_at: '2026-08-01 10:00:00',
          solution_released_at: '2026-08-03 10:00:00',
        },
        {
          handed_off_at: '2026-08-01 10:00:00',
          solution_released_at: '2026-08-05 10:00:00',
        },
      ],
      consult_to_proposal: [
        {
          consult_entered_at: '2026-08-01 10:00:00',
          proposal_entered_at: '2026-08-02 10:00:00',
        },
        {
          consult_entered_at: '2026-08-01 10:00:00',
          proposal_entered_at: '2026-08-10 10:00:00',
        },
      ],
      consult_tasks: [
        {
          form_fields: [{ key: 'a' }, { key: 'b' }],
          form_data: { a: 'x', b: '' },
          is_done: false,
        },
        {
          form_fields: [{ key: 'a' }],
          form_data: { a: 'ok' },
          is_done: true,
        },
      ],
    });

    expect(out.go_to_consult_median_hours).toBe(36);
    expect(out.go_to_consult_sample).toBe(2);
    expect(out.go_to_handoff_median_hours).toBe(17);
    expect(out.go_to_handoff_sample).toBe(2);
    expect(out.handoff_to_release_median_hours).toBe(72);
    expect(out.handoff_to_release_sample).toBe(2);
    expect(out.consult_to_proposal_48h_num).toBe(1);
    expect(out.consult_to_proposal_48h_denom).toBe(2);
    expect(out.consult_to_proposal_48h_pct).toBe(50);
    expect(out.consult_to_proposal_7d_num).toBe(1);
    expect(out.consult_task_done_rate).toBe(50);
    expect(out.consult_form_completion_pct).toBe(75);
  });

  it('flags 7d window', () => {
    expect(
      isConsultToProposalWithin7d('2026-08-01 10:00:00', '2026-08-05 10:00:00'),
    ).toBe(true);
    expect(
      isConsultToProposalWithin7d('2026-08-01 10:00:00', '2026-08-15 10:00:00'),
    ).toBe(false);
  });
});
