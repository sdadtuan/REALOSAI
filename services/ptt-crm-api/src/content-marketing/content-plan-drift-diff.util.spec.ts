import { buildDriftDiffPayload, diffPlannerCalendar, diffPlannerPillars } from './content-plan-drift-diff.util';

describe('content-plan-drift-diff.util', () => {
  it('diffPlannerPillars detects added and removed', () => {
    const out = diffPlannerPillars(
      [{ name: 'Old', goal: 'awareness', topics: [], sort_order: 0 }],
      [
        { name: 'Old', goal: 'awareness', topics: [], sort_order: 0 },
        { name: 'New', goal: 'lead', topics: ['x'], sort_order: 1 },
      ],
    );
    expect(out.added).toHaveLength(1);
    expect(out.added[0].name).toBe('New');
    expect(out.removed).toHaveLength(0);
  });

  it('diffPlannerCalendar detects changed channel', () => {
    const out = diffPlannerCalendar(
      [{ title: 'Post A', date: '2026-08-10', channel: 'facebook', type: 'social_post' }],
      [{ title: 'Post A', date: '2026-08-10', channel: 'linkedin', type: 'social_post' }],
    );
    expect(out.changed.some((c) => c.field === 'channel')).toBe(true);
  });

  it('buildDriftDiffPayload wraps sections', () => {
    const out = buildDriftDiffPayload({
      drift: true,
      canReingest: true,
      snapshotPillars: [],
      currentPillars: [{ name: 'P1', goal: 'lead', topics: [], sort_order: 0 }],
      snapshotCalendar: [],
      currentCalendar: [{ title: 'X', date: '2026-08-01', channel: 'facebook' }],
    });
    expect(out.drift).toBe(true);
    expect(out.pillars.added).toHaveLength(1);
    expect(out.calendar.added).toHaveLength(1);
  });
});
