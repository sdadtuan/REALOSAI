import { describe, expect, it } from 'vitest';
import {
  adsRoasCopy,
  agingBucketLabel,
  buildMilestoneDisplay,
  collectionsPageDisclaimer,
  financeHubDisclaimer,
  summarizeAgingBuckets,
} from './finance-copy';

describe('finance-copy', () => {
  it('U-09 disclaimer', () => {
    expect(financeHubDisclaimer()).toContain('không phải hạch toán');
    expect(collectionsPageDisclaimer()).toContain('Sổ thu căn');
  });

  it('ROAS does not invent spend', () => {
    expect(adsRoasCopy(false)).toBe('Chưa gắn ad account');
  });

  it('aging bucket labels', () => {
    expect(agingBucketLabel('60_plus')).toBe('>60 ngày');
  });

  it('build milestone display', () => {
    expect(buildMilestoneDisplay('cot', 'Cất nóc')).toMatch(/Cất nóc/);
  });

  it('summarize aging buckets', () => {
    const out = summarizeAgingBuckets([
      { bucket: '0_15', amount_vnd: 100, paid_vnd: 20 },
      { bucket: '60_plus', amount_vnd: 200, paid_vnd: 0 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[1].remainingVnd).toBe(200);
  });
});
