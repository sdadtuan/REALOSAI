import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffOrgService } from '../../staff-org/staff-org.service';
import { BdsStaffKpiRepository } from './bds-staff-kpi.repository';

@Injectable()
export class BdsStaffKpiService {
  constructor(
    private readonly repo: BdsStaffKpiRepository,
    private readonly org: StaffOrgService,
  ) {}

  async staffMetrics(
    staffId: number,
    tenantId: string,
    year?: string,
    month?: string,
  ) {
    const id = Number(staffId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException({ error: 'staff_id' });
    }
    const tid = String(tenantId ?? '').trim();
    if (!tid) {
      throw new BadRequestException({ error: 'tenant_id' });
    }

    const users = await this.org.listUsers({ includeInactive: true });
    const match = users.find((u) => Number(u.crm_staff_id) === id);
    if (!match) {
      throw new NotFoundException({ error: 'staff_not_found' });
    }

    const now = new Date();
    const y = year != null && year !== '' ? Number(year) : now.getUTCFullYear();
    const m = month != null && month !== '' ? Number(month) : now.getUTCMonth() + 1;
    if (!Number.isFinite(y) || y < 2000 || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException({ error: 'period' });
    }

    return this.repo.staffMetrics(id, tid, y, m);
  }
}
