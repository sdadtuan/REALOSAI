import { describe, expect, it } from 'vitest';
import {
  collectReportSnapshotStaleRows,
  insightsById,
  reportSnapshotRowIsStale,
  reportVersionHasStaleInsights,
  snapshotInsightId,
} from './report-stale.util';

describe('report-stale.util', () => {
  const ref = new Date('2026-08-17T12:00:00Z');
  const map = insightsById([
    { id: 11, valid_to: '2020-01-01' } as never,
    { id: 12, valid_to: '2026-08-17' } as never,
  ]);

  it('P42 snapshotInsightId reads positive insight_id', () => {
    expect(snapshotInsightId({ insight_id: 11 })).toBe(11);
    expect(snapshotInsightId({ insight_id: 0 })).toBe(null);
  });

  it('P42 reportSnapshotRowIsStale uses live valid_to', () => {
    expect(reportSnapshotRowIsStale({ insight_id: 11 }, map, ref)).toBe(true);
    expect(reportSnapshotRowIsStale({ insight_id: 12 }, map, ref)).toBe(false);
    expect(reportSnapshotRowIsStale({ insight_id: 99 }, map, ref)).toBe(false);
  });

  it('P42 ignores published_valid_to on snapshot row', () => {
    expect(
      reportSnapshotRowIsStale({ insight_id: 12, published_valid_to: '2099-01-01' }, map, ref),
    ).toBe(false);
  });

  it('P42 collectReportSnapshotStaleRows lists finding and rec separately', () => {
    const rows = collectReportSnapshotStaleRows(
      [{ insight_id: 11, statement: 'secret' }],
      [{ insight_id: 11, recommendation: 'act' }],
      [{ id: 11, valid_to: '2020-01-01' } as never],
      ref,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ insightId: 11, kind: 'finding' });
    expect(rows[1]).toMatchObject({ insightId: 11, kind: 'rec' });
  });

  it('P43 reportVersionHasStaleInsights is true when any row stale', () => {
    const insights = [{ id: 11, valid_to: '2020-01-01' } as never];
    expect(
      reportVersionHasStaleInsights(
        [{ insight_id: 11 }],
        [],
        insights,
        ref,
      ),
    ).toBe(true);
    expect(reportVersionHasStaleInsights([], [], insights, ref)).toBe(false);
    expect(
      reportVersionHasStaleInsights([{ insight_id: 99 }], [], insights, ref),
    ).toBe(false);
  });
});
