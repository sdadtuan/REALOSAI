import { NotFoundException } from '@nestjs/common';
import { BdsHubService } from './bds-hub.service';

describe('BdsHubService', () => {
  const tenants = { getMe: jest.fn() };
  const repo = {
    kpi: jest.fn(),
    pendingHolds: jest.fn(),
    byTower: jest.fn(),
    byAgency: jest.fn(),
    metaAdMapped: jest.fn(),
    listLeaderboard: jest.fn(),
  };
  const svc = new BdsHubService(tenants as never, repo as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('UC-001 broker hub → 404', async () => {
    tenants.getMe.mockResolvedValue({ id: 't1', mode: 'broker' });
    await expect(svc.getHub('t1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.kpi).not.toHaveBeenCalled();
  });

  it('UC-001 developer returns kpi + inbox ≤8', async () => {
    tenants.getMe.mockResolvedValue({ id: 't1', mode: 'developer' });
    repo.kpi.mockResolvedValue({
      sell_through_pct: 25,
      gmv_contracted_month_vnd: 1,
      overdue_gt_30d: 0,
      holds_expiring_2h: 2,
      cskh_breach_15m: 0,
      receipts_today_count: 0,
      collected_month_vnd: 0,
      hh_payable_month_vnd: 0,
    });
    repo.pendingHolds.mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => ({
        kind: 'hold_f1_pending' as const,
        id: `h${i}`,
        label: `A-${i}`,
        href: '/crm/bds/holds',
      })),
    );
    repo.byTower.mockResolvedValue([]);
    repo.byAgency.mockResolvedValue([]);
    repo.metaAdMapped.mockResolvedValue(false);
    const out = await svc.getHub('t1');
    expect(out.kpi.sell_through_pct).toBe(25);
    expect(out.meta_ad_mapped).toBe(false);
    expect(out.inbox).toHaveLength(8);
  });

  it('exportHdqtCsv uses contracted GMV not list price', async () => {
    tenants.getMe.mockResolvedValue({ id: 't1', mode: 'developer' });
    repo.kpi.mockResolvedValue({
      sell_through_pct: 10,
      gmv_contracted_month_vnd: 9000,
      overdue_gt_30d: 2,
      holds_expiring_2h: 0,
      cskh_breach_15m: 0,
      receipts_today_count: 0,
      collected_month_vnd: 1000,
      hh_payable_month_vnd: 300,
    });
    repo.pendingHolds.mockResolvedValue([]);
    repo.byTower.mockResolvedValue([]);
    repo.byAgency.mockResolvedValue([]);
    repo.metaAdMapped.mockResolvedValue(true);
    const csv = await svc.exportHdqtCsv('t1');
    expect(csv).toContain('9000,1000,2,300');
    expect(csv).not.toContain('list_price');
  });
});
