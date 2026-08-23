import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { StaffOrgService } from '../../staff-org/staff-org.service';
import { capsForPosition } from './bds-position-default-caps';

export const BDS_DEPARTMENT_SEEDS = [
  { code: 'ban_tgd', name: 'Ban Điều hành' },
  { code: 'ban_du_an', name: 'Ban Dự án' },
  { code: 'ban_san_pham', name: 'Ban Sản phẩm – Giỏ hàng' },
  { code: 'ban_kd', name: 'Ban Kinh doanh Inhouse' },
  { code: 'ban_kenh', name: 'Ban Kênh phân phối' },
  { code: 'ban_cskh_presales', name: 'Ban CSKH trước bán' },
  { code: 'ban_mkt', name: 'Ban Marketing' },
  { code: 'ban_phap_che', name: 'Ban Pháp chế' },
  { code: 'ban_tc_collection', name: 'Ban Tài chính – Công nợ' },
  { code: 'ban_tc_hh', name: 'Ban Tài chính – Hoa hồng' },
  { code: 'ban_cskh_after', name: 'Ban CSKH sau bán' },
  { code: 'ban_hr', name: 'Ban Nhân sự' },
] as const;

export const BDS_POSITION_SEEDS = [
  { code: 'tgd', name: 'Tổng giám đốc', department_code: 'ban_tgd' },
  { code: 'gdkd', name: 'Giám đốc khối KD', department_code: 'ban_kd' },
  { code: 'pm_du_an', name: 'Giám đốc / PM dự án', department_code: 'ban_du_an' },
  { code: 'truong_sp', name: 'Trưởng sản phẩm', department_code: 'ban_san_pham' },
  { code: 'cv_gia', name: 'Chuyên viên bảng giá', department_code: 'ban_san_pham' },
  { code: 'truong_inhouse', name: 'Trưởng gallery / Inhouse', department_code: 'ban_kd' },
  { code: 'tvv_inhouse', name: 'TVV tự doanh', department_code: 'ban_kd' },
  { code: 'truong_kenh', name: 'Trưởng ban kênh', department_code: 'ban_kenh' },
  { code: 'am_kenh', name: 'AM đại lý', department_code: 'ban_kenh' },
  { code: 'cskh_lead', name: 'CSKH trước bán', department_code: 'ban_cskh_presales' },
  { code: 'truong_mkt', name: 'Trưởng MKT', department_code: 'ban_mkt' },
  { code: 'truong_pc', name: 'Trưởng pháp chế', department_code: 'ban_phap_che' },
  { code: 'cv_hd', name: 'CV hợp đồng', department_code: 'ban_phap_che' },
  { code: 'truong_collection', name: 'Trưởng công nợ', department_code: 'ban_tc_collection' },
  { code: 'cv_hh', name: 'CV hoa hồng', department_code: 'ban_tc_hh' },
  { code: 'truong_after', name: 'Trưởng CSKH sau bán', department_code: 'ban_cskh_after' },
  { code: 'cv_ban_giao', name: 'CV bàn giao', department_code: 'ban_cskh_after' },
  { code: 'hr_bp', name: 'HR BP', department_code: 'ban_hr' },
] as const;

export const REQUIRED_POSITION_CODES = [
  'pm_du_an',
  'gdkd',
  'truong_pc',
  'truong_collection',
  'truong_sp',
] as const;

export function missingRequiredPositions(assigned: string[]): string[] {
  const have = new Set(assigned);
  return REQUIRED_POSITION_CODES.filter((c) => !have.has(c));
}

const SEED_ACTOR = 'bds-org-seed';

const POSITION_INSERT_SQL = `
INSERT INTO crm_positions (code, name, department_id, parent_id, active, updated_at)
SELECT $1, $2, d.id, NULL, TRUE, NOW()
FROM crm_departments d
WHERE d.code = $3
  AND NOT EXISTS (SELECT 1 FROM crm_positions p WHERE p.code = $1)
`;

const CAP_INSERT_SQL = `
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, $2, $3 FROM crm_positions p
WHERE p.code = $1
ON CONFLICT (position_id, section_id, action) DO NOTHING
`;

@Injectable()
export class BdsOrgSeedService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly org: StaffOrgService,
    private readonly config: AppConfigService,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async seedForTenant(tenantId: string, mode: string): Promise<void> {
    void tenantId;
    if (mode === 'broker') {
      return;
    }

    const departments = await this.org.listDepartments();
    const deptByCode = new Map(departments.map((d) => [d.code, d]));
    const teams = await this.org.listTeams();
    const teamCodes = new Set(teams.map((t) => t.code));

    for (const seed of BDS_DEPARTMENT_SEEDS) {
      let dept = deptByCode.get(seed.code);
      if (!dept) {
        dept = await this.org.createDepartment(
          { code: seed.code, name: seed.name },
          SEED_ACTOR,
        );
        deptByCode.set(seed.code, dept);
      }
      if (!teamCodes.has(seed.code)) {
        await this.org.createTeam(
          { code: seed.code, name: seed.name, department_id: dept.id },
          SEED_ACTOR,
        );
        teamCodes.add(seed.code);
      }
    }

    for (const pos of BDS_POSITION_SEEDS) {
      await this.db.query(POSITION_INSERT_SQL, [pos.code, pos.name, pos.department_code]);
    }

    await this.seedPositionDefaultCaps();
  }

  private async seedPositionDefaultCaps(): Promise<void> {
    for (const pos of BDS_POSITION_SEEDS) {
      for (const cap of capsForPosition(pos.code)) {
        await this.db.query(CAP_INSERT_SQL, [pos.code, cap.section, cap.action]);
      }
    }
  }
}
