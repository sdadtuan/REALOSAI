import { describe, expect, it } from 'vitest';
import {
  buildTmmtApplyDiff,
  summarizeApplyDiff,
} from './mkt-ai-apply-diff';
import {
  canExportFormat,
  getQualityTier,
  qualityTierLabel,
} from './mkt-ai-quality-labels';

describe('mkt-ai-quality-labels', () => {
  it('classifies score tiers', () => {
    expect(getQualityTier(55)).toBe('blocked');
    expect(getQualityTier(65)).toBe('conditional');
    expect(getQualityTier(78)).toBe('ready');
    expect(qualityTierLabel(getQualityTier(65))).toContain('DOCX');
  });

  it('gates export formats by score', () => {
    expect(canExportFormat('pdf', 55)).toBe(false);
    expect(canExportFormat('docx', 65)).toBe(true);
    expect(canExportFormat('pdf', 65)).toBe(false);
    expect(canExportFormat('pdf', 75)).toBe(true);
  });
});

describe('mkt-ai-apply-diff', () => {
  it('builds diff between official and draft TMMT', () => {
    const diffs = buildTmmtApplyDiff(
      { target_market: 'Old market' },
      { market_context: 'Old context' },
      { target_market: 'New market draft' },
      { market_context: 'Old context', segmentation_icp: 'New ICP' },
    );
    const summary = summarizeApplyDiff(diffs);
    expect(diffs.some((d) => d.key === 'target_market' && d.changed)).toBe(true);
    expect(summary.changedCount).toBeGreaterThan(0);
    expect(summary.previewLines.length).toBeGreaterThan(0);
  });
});
