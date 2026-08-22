import {
  computeCreditRatio,
  computeLeadDays,
  computeRate,
  computeTakesPerShot,
} from './vd-report-metrics';
import { VdReportService } from './vd-report.service';

describe('vd-report-metrics', () => {
  it('computes takes_per_shot = takes / shots (6 / 2 → 3)', () => {
    expect(computeTakesPerShot(6, 2)).toBe(3);
  });

  it('returns 0 takes_per_shot when no shots', () => {
    expect(computeTakesPerShot(6, 0)).toBe(0);
  });

  it('computes credit_ratio actual/estimated', () => {
    expect(computeCreditRatio(12, 10)).toBe(1.2);
  });

  it('computes lead_days between created and delivered', () => {
    const days = computeLeadDays('2026-08-01T00:00:00.000Z', '2026-08-04T12:00:00.000Z');
    expect(days).toBeGreaterThanOrEqual(3);
  });
});

describe('VdReportService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;

  it('aggregates production metrics for lifecycle', async () => {
    const service = new VdReportService(
      config,
      {
        listByLifecycle: jest.fn().mockResolvedValue([
          {
            id: 1,
            lifecycle_id: 3,
            stage: 'delivered',
            created_at: '2026-08-01T00:00:00.000Z',
            updated_at: '2026-08-03T00:00:00.000Z',
          },
        ]),
        getById: jest.fn().mockResolvedValue({
          id: 1,
          stage: 'delivered',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
        }),
      } as never,
      {
        listByProjectId: jest.fn().mockResolvedValue([
          { status: 'keyframe_approved' },
          { status: 'clip_selected' },
        ]),
      } as never,
      { listByProjectId: jest.fn().mockResolvedValue([{}, {}, {}, {}, {}, {}]) } as never,
      {
        sumByKind: jest.fn().mockImplementation((_pid, kind) =>
          Promise.resolve(kind === 'estimated' ? 10 : 8),
        ),
      } as never,
      {
        countReworks: jest.fn().mockResolvedValue(1),
        countOverrides: jest.fn().mockResolvedValue(0),
        countApprovals: jest.fn().mockResolvedValue(2),
      } as never,
      { insert: jest.fn().mockResolvedValue({}) } as never,
    );

    const report = await service.getProductionReport(3);
    expect(report.lifecycle_id).toBe(3);
    expect(report.metrics).toHaveLength(7);
    const takes = report.metrics.find((row) => row.metric === 'takes_per_shot');
    expect(takes?.value).toBe(3);
    expect(computeRate(1, 2)).toBe(0.5);
  });
});
