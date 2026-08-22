import {
  buildPresalesWorkflowUpgradePlan,
  mergeLegacyPresalesFormData,
  normalizeUpgradeStages,
} from './presales-workflow-upgrade.util';

describe('presales-workflow-upgrade.util', () => {
  it('maps generic consult_notes to current_status', () => {
    const out = mergeLegacyPresalesFormData(
      [{ form_data: { consult_notes: 'Funnel yếu' }, is_done: false }],
      ['current_status', 'target_audience'],
    );
    expect(out.form_data.current_status).toBe('Funnel yếu');
  });

  it('plans lead-gen upgrade from generic tasks', () => {
    const plan = buildPresalesWorkflowUpgradePlan(
      'lead-gen',
      ['consult'],
      {
        consult: [{ form_data: { consult_notes: 'x' }, is_done: false }],
      },
    );
    expect(plan.stages[0]?.deleted).toBe(1);
    expect(plan.stages[0]?.inserted).toBe(1);
    expect(plan.stages[0]?.mapped_fields).toContain('current_status');
  });

  it('defaults stages when empty', () => {
    expect(normalizeUpgradeStages()).toEqual(['lead', 'consult', 'proposal']);
  });
});
