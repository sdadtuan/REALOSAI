import { annotatePortalReportRow, collectReportInsightIds } from './portal-report-stale.util';

const ref = new Date('2026-08-16T12:00:00.000Z');

it('P24 collectReportInsightIds unions findings recs and insight_ids', () => {
  expect(
    collectReportInsightIds({
      findings: [{ insight_id: 1 }, { insight_id: 2 }],
      recs: [{ insight_id: 2 }, { insight_id: 3 }],
      insight_ids: [3, 4, 0],
    }).sort((a, b) => a - b),
  ).toEqual([1, 2, 3, 4]);
});

it('P24 annotate sets is_stale from live valid_to', () => {
  const map = new Map<number, string | null>([
    [11, '2020-01-01'],
    [12, '2026-08-16'],
    [13, null],
  ]);
  expect(annotatePortalReportRow({ insight_id: 11, statement: 'A' }, map, ref)).toMatchObject({
    insight_id: 11,
    is_stale: true,
    valid_to: '2020-01-01',
  });
  expect(annotatePortalReportRow({ insight_id: 12, statement: 'B' }, map, ref)).toMatchObject({
    is_stale: false,
    valid_to: '2026-08-16',
  });
  expect(annotatePortalReportRow({ insight_id: 13, statement: 'C' }, map, ref)).toMatchObject({
    is_stale: false,
    valid_to: null,
  });
  expect(annotatePortalReportRow({ insight_id: 99, statement: 'missing' }, map, ref)).toMatchObject({
    is_stale: false,
    valid_to: null,
  });
  expect(annotatePortalReportRow('plain', map, ref)).toBe('plain');
});
