import { describe, expect, it } from 'vitest';
import type { ResearchInsight, ResearchReportVersion } from '@/lib/market-research-api';
import { staffReportVersionHasStaleInsights } from './staff-report-stale.util';

const ref = new Date('2026-08-18T12:00:00.000Z');

function insight(id: number, validTo: string | null): ResearchInsight {
  return {
    id,
    project_id: 9,
    statement: 's',
    observation: null,
    interpretation: null,
    implication: null,
    recommendation: null,
    audience: null,
    status: 'approved_internal',
    confidence_rationale: null,
    confidence_json: null,
    ai_generated: false,
    created_by: 'an@ptt',
    valid_from: null,
    valid_to: validTo,
    created_at: '2026-08-14',
    updated_at: '2026-08-14',
    evidence_ids: [],
  };
}

function version(
  overrides: Partial<ResearchReportVersion> = {},
): Pick<ResearchReportVersion, 'has_stale_insights' | 'content_snapshot'> {
  return {
    content_snapshot: {
      findings: [{ insight_id: 11, text: 'f' }],
      recs: [],
    },
    ...overrides,
  };
}

describe('staff-report-stale.util', () => {
  it('P44 prefers API has_stale_insights true over client fresh join', () => {
    const insights = [insight(11, '2026-12-31')];
    expect(
      staffReportVersionHasStaleInsights(
        version({ has_stale_insights: true }),
        insights,
        ref,
      ),
    ).toBe(true);
  });

  it('P44 prefers API has_stale_insights false over client stale join', () => {
    const insights = [insight(11, '2020-01-01')];
    expect(
      staffReportVersionHasStaleInsights(
        version({ has_stale_insights: false }),
        insights,
        ref,
      ),
    ).toBe(false);
  });

  it('P44 falls back to client join when API field missing', () => {
    const insights = [insight(11, '2020-01-01')];
    expect(staffReportVersionHasStaleInsights(version(), insights, ref)).toBe(true);
    expect(
      staffReportVersionHasStaleInsights(version(), [insight(11, '2026-12-31')], ref),
    ).toBe(false);
  });
});
