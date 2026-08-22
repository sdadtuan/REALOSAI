import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { KpiService } from '../kpi/kpi.service';
import { CrmStaffPgRepository } from './crm-staff-pg.repository';
import { CrmStaffSqliteRepository } from './crm-staff-sqlite.repository';
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
    private readonly sqlite: CrmStaffSqliteRepository,
    private readonly pg: CrmStaffPgRepository,
    private readonly config: AppConfigService,
    private readonly kpi: KpiService,
  ) {}

  listStaff() {
    if (this.config.crmStaffPg) {
      return this.pg.listStaff(500);
    }
    return this.sqlite.listStaff(500);
  }

  async detail(staffId: number) {
    if (this.config.crmStaffPg) {
      const staff = await this.pg.getStaffById(staffId);
      if (!staff) {
        throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
      }
      return staff;
    }
    const staff = this.sqlite.getStaffById(staffId);
    if (!staff) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return staff;
  }

  async workspace(staffId: number) {
    if (this.config.crmStaffPg) {
      const bundle = await this.pg.getWorkspace(staffId);
      if (!bundle) {
        throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
      }
      return bundle;
    }
    const bundle = this.sqlite.getWorkspace(staffId);
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

    if (this.config.crmStaffPg) {
      const updated = await this.pg.patchStaff(staffId, body);
      if (!updated) {
        throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
      }
      return updated;
    }

    const updated = this.sqlite.patchStaff(staffId, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy nhân viên' });
    }
    return updated;
  }

  listStaffKpi(year?: string, month?: string, staffId?: string) {
    return this.kpi.listStaffKpi(year, month, staffId);
  }

  getLevels() {
    if (this.config.crmStaffPg) {
      return this.pg.getStaffLevels();
    }
    return this.sqlite.getStaffLevels();
  }

  async saveLevels(body: StaffLevelsPutBody) {
    if (!Array.isArray(body.staff_levels)) {
      throw new BadRequestException({ error: 'staff_levels phải là mảng' });
    }
    try {
      if (this.config.crmStaffPg) {
        return await this.pg.saveStaffLevels(body.staff_levels);
      }
      return this.sqlite.saveStaffLevels(body.staff_levels);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_LEVELS') {
        throw new BadRequestException({ error: 'staff_levels không hợp lệ' });
      }
      throw err;
    }
  }

  getCompetency() {
    if (this.config.crmStaffPg) {
      return this.pg.getCompetencyConfig();
    }
    return this.sqlite.getCompetencyConfig();
  }

  async saveCompetency(body: StaffCompetencyPutBody) {
    const competency = body.competency ?? (body as unknown as Record<string, unknown>);
    if (!competency || typeof competency !== 'object') {
      throw new BadRequestException({ error: 'competency không hợp lệ' });
    }
    if (this.config.crmStaffPg) {
      return this.pg.saveCompetencyConfig(competency as Record<string, unknown>);
    }
    return this.sqlite.saveCompetencyConfig(competency as Record<string, unknown>);
  }

  async importStaff(body: StaffImportBody) {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      throw new BadRequestException({ error: 'Thiếu rows' });
    }
    if (this.config.crmStaffPg) {
      return this.pg.importStaffRows(rows);
    }
    return this.sqlite.importStaffRows(rows);
  }
}
