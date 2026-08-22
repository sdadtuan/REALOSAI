import {
  buildPortalOpsSummary,
  metricProgressPct,
  worstPortalKpiLabel,
} from './portal-ops-summary.util';
import type { OpsPortalLinkedLifecycle, OpsPortalSummary } from './portal-ops.types';

describe('portal-ops-summary.util', () => {
  it('worstPortalKpiLabel prefers KhongDat over CanChuY', () => {
    expect(
      worstPortalKpiLabel([
        { status_label: 'Dat' },
        { status_label: 'CanChuY' },
        { status_label: 'KhongDat' },
      ]),
    ).toBe('KhongDat');
  });

  it('buildPortalStatusMessageVi for Dat', () => {
    const out = buildPortalOpsSummary({
      lifecycleId: 1,
      serviceSlug: 'tiep-thi-noi-dung',
      dvCode: 'DV02',
      dvName: 'Content',
      stage: 'deliver',
      packageTier: 'standard',
      isoWeek: '2026-W32',
      weeklySpawned: true,
      tasksDone: 3,
      tasksPending: 1,
      periodKey: '2026-08',
      overallLabel: 'Dat',
      metrics: [
        {
          key: 'posts',
          label: 'Bài đăng',
          status_label: 'Dat',
          progress_pct: metricProgressPct(10, 8),
        },
      ],
    });
    expect(out.weekly.progress_pct).toBe(75);
    expect(out.status_message_vi).toContain('đạt mục tiêu');
  });
});
