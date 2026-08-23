import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BdsStaffKpiService } from './bds-staff-kpi.service';

describe('BdsStaffKpiService', () => {
  const repo = {
    staffMetrics: jest.fn().mockResolvedValue({
      metrics: [{ key: 'bds_gmv_hdmb_vnd', label: 'GMV', value: 1 }],
    }),
  };
  const org = {
    listUsers: jest.fn().mockResolvedValue([{ crm_staff_id: 9, email: 'a@b.c' }]),
  };
  let svc: BdsStaffKpiService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new BdsStaffKpiService(repo as never, org as never);
  });

  it('returns three-metric pack for known staff', async () => {
    const out = await svc.staffMetrics(9, 't1', '2026', '8');
    expect(repo.staffMetrics).toHaveBeenCalledWith(9, 't1', 2026, 8);
    expect(out.metrics).toHaveLength(1);
  });

  it('404 when staff not in org roster', async () => {
    org.listUsers.mockResolvedValue([]);
    await expect(svc.staffMetrics(9, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400 on invalid period', async () => {
    org.listUsers.mockResolvedValue([{ crm_staff_id: 9, email: 'a@b.c' }]);
    await expect(svc.staffMetrics(9, 't1', '2026', '13')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
