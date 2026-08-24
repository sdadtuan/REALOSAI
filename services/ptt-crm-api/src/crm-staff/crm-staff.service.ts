import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiService } from '../kpi/kpi.service';
import { CrmStaffPgRepository } from './crm-staff-pg.repository';
import {
  isValidEmail,
  PatchCrmStaffBody,
  StaffCompetencyPutBody,
  StaffImportBody,
  StaffLevelsPutBody,
} from './crm-staff.types';

@Injectable()
export class CrmStaffService {
  constructor(
    private readonly pg: CrmStaffPgRepository,
    private readonly kpi: KpiService,
  ) {}

  listStaff() {
    return this.pg.listStaff(500);
  }

  async detail(staffId: number) {
    const staff = await this.pg.getStaffById(staffId);
    if (!staff) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return staff;
  }

  async workspace(staffId: number) {
    const bundle = await this.pg.getWorkspace(staffId);
    if (!bundle) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return bundle;
  }

  async patch(staffId: number, body: PatchCrmStaffBody) {
    if ('name' in body && body.name != null) {
      const nm = String(body.name).trim();
      if (!nm) {
        throw new BadRequestException({ error: 'Tên không được trống' });
      }
    }
    if ('email' in body && body.email != null) {
      const em = String(body.email).trim();
      if (em && !isValidEmail(em)) {
        throw new BadRequestException({ error: 'Email không hợp lệ' });
      }
    }

    const updated = await this.pg.patchStaff(staffId, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return updated;
  }

  listStaffKpi(year?: string, month?: string, staffId?: string) {
    return this.kpi.listStaffKpi(year, month, staffId);
  }

  getLevels() {
    return this.pg.getStaffLevels();
  }

  async saveLevels(body: StaffLevelsPutBody) {
    if (!Array.isArray(body.staff_levels)) {
      throw new BadRequestException({ error: 'staff_levels phải là mảng' });
    }
    try {
      return await this.pg.saveStaffLevels(body.staff_levels);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_LEVELS') {
        throw new BadRequestException({ error: 'staff_levels không hợp lệ' });
      }
      throw err;
    }
  }

  getCompetency() {
    return this.pg.getCompetencyConfig();
  }

  async saveCompetency(body: StaffCompetencyPutBody) {
    const competency = body.competency ?? (body as unknown as Record<string, unknown>);
    if (!competency || typeof competency !== 'object') {
      throw new BadRequestException({ error: 'competency không hợp lệ' });
    }
    return this.pg.saveCompetencyConfig(competency as Record<string, unknown>);
  }

  async importStaff(body: StaffImportBody) {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      throw new BadRequestException({ error: 'Thiếu rows' });
    }
    return this.pg.importStaffRows(rows);
  }
}
