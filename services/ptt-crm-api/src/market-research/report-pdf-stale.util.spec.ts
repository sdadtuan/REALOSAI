import { reportSnapshotHasStaleInsights } from './report-pdf-stale.util';

describe('report-pdf-stale.util', () => {
  it('P29 false when no insight ids', () => {
    expect(reportSnapshotHasStaleInsights({ findings: [], recs: [] }, new Map())).toBe(false);
  });

  it('P29 true when any linked insight is stale', () => {
    const map = new Map([[11, '2020-01-01']]);
    expect(
      reportSnapshotHasStaleInsights(
        { findings: [{ insight_id: 11, text: 'x' }], recs: [] },
        map,
        new Date('2026-08-16T12:00:00Z'),
      ),
    ).toBe(true);
  });

  it('P29 false when id missing from map (portal unpublished rule)', () => {
    expect(
      reportSnapshotHasStaleInsights(
        { findings: [{ insight_id: 99, text: 'x' }], recs: [] },
        new Map(),
      ),
    ).toBe(false);
  });

  it('P29 false when valid_to is null', () => {
    expect(
      reportSnapshotHasStaleInsights(
        { findings: [{ insight_id: 11, text: 'x' }], recs: [] },
        new Map([[11, null]]),
        new Date('2026-08-16T12:00:00Z'),
      ),
    ).toBe(false);
  });
});
