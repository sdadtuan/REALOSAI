import {
  buildBatchUpgradeCsvHeader,
  capBatchLeadIds,
  cohortCsvRow,
  needsPresalesWorkflowUpgrade,
  PRESALES_BATCH_UPGRADE_MAX,
  resolveBatchUpgradeStages,
} from './presales-workflow-batch.util';

describe('presales-workflow-batch.util', () => {
  it('flags generic consult (1 field) for upgrade', () => {
    expect(needsPresalesWorkflowUpgrade(1)).toBe(true);
    expect(needsPresalesWorkflowUpgrade(3)).toBe(true);
    expect(needsPresalesWorkflowUpgrade(4)).toBe(false);
  });

  it('caps batch lead ids at max 50', () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    expect(capBatchLeadIds(ids)).toHaveLength(PRESALES_BATCH_UPGRADE_MAX);
    expect(capBatchLeadIds(ids, 10)).toHaveLength(10);
  });

  it('dedupes lead ids', () => {
    expect(capBatchLeadIds([1, 1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('formats cohort CSV row', () => {
    const row = cohortCsvRow({
      lead_id: 900000002,
      presales_id: 1,
      service_slug: 'lead-gen',
      stage: 'consult',
      consult_field_keys: ['consult_notes'],
    });
    expect(row).toBe('900000002,lead-gen,consult_notes');
    expect(buildBatchUpgradeCsvHeader()).toBe('lead_id,service_slug,old_field_keys');
  });

  it('defaults batch stages', () => {
    expect(resolveBatchUpgradeStages()).toEqual(['lead', 'consult', 'proposal']);
  });
});
