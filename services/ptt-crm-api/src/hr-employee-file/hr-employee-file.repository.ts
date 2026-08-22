import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  HrStaffAddressRow,
  HrStaffIdentityRow,
  HrStaffProfileStaffSummary,
  PatchHrStaffIdentityBody,
  PutHrStaffAddressInput,
} from './hr-employee-file.types';

const IDENTITY_SELECT = `
  staff_id::int, legal_name, dob::text, gender, nationality, cccd,
  cccd_issued_on::text, cccd_issued_by, tax_code, bank_name, bank_account,
  bank_holder, timeclock_pin, created_at::text, updated_at::text
`;

const ADDRESS_SELECT = `
  id::int, staff_id::int, kind, province_code, district_code, ward_code,
  line1, same_as_permanent, created_at::text, updated_at::text
`;

@Injectable()
export class HrEmployeeFileRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private tablesReadyCache: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.tablesReadyCache = null;
  }

  async tablesReady(): Promise<boolean> {
    if (this.tablesReadyCache != null) return this.tablesReadyCache;
    try {
      await this.db.query(`SELECT 1 FROM hr_staff_identity LIMIT 1`);
      this.tablesReadyCache = true;
    } catch {
      this.tablesReadyCache = false;
    }
    return this.tablesReadyCache;
  }

  private mapIdentity(row: Record<string, unknown>): HrStaffIdentityRow {
    return {
      staff_id: Number(row.staff_id),
      legal_name: String(row.legal_name ?? ''),
      dob: row.dob ? String(row.dob).slice(0, 10) : null,
      gender: String(row.gender ?? ''),
      nationality: String(row.nationality ?? 'VN'),
      cccd: String(row.cccd ?? ''),
      cccd_issued_on: row.cccd_issued_on ? String(row.cccd_issued_on).slice(0, 10) : null,
      cccd_issued_by: String(row.cccd_issued_by ?? ''),
      tax_code: String(row.tax_code ?? ''),
      bank_name: String(row.bank_name ?? ''),
      bank_account: String(row.bank_account ?? ''),
      bank_holder: String(row.bank_holder ?? ''),
      timeclock_pin: String(row.timeclock_pin ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapAddress(row: Record<string, unknown>): HrStaffAddressRow {
    return {
      id: Number(row.id),
      staff_id: Number(row.staff_id),
      kind: String(row.kind) as HrStaffAddressRow['kind'],
      province_code: String(row.province_code ?? ''),
      district_code: String(row.district_code ?? ''),
      ward_code: String(row.ward_code ?? ''),
      line1: String(row.line1 ?? ''),
      same_as_permanent: Boolean(row.same_as_permanent),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async getStaffSummary(staffId: number): Promise<HrStaffProfileStaffSummary | null> {
    const result = await this.db.query(
      `SELECT s.id::int, s.name, s.phone, s.email, s.job_title, s.department,
              s.internal_code, s.active::int, s.started_on::text,
              COALESCE(d.name, '') AS dept_name
       FROM crm_staff s
       LEFT JOIN crm_departments d ON d.id = s.department_id
       WHERE s.id = $1
       LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      job_title: String(row.job_title ?? ''),
      department: String(row.department ?? ''),
      internal_code: String(row.internal_code ?? ''),
      active: Number(row.active ?? 0),
      dept_name: String(row.dept_name ?? ''),
      started_on: row.started_on ? String(row.started_on).slice(0, 10) : '',
    };
  }

  async getIdentity(staffId: number): Promise<HrStaffIdentityRow | null> {
    const result = await this.db.query(
      `SELECT ${IDENTITY_SELECT} FROM hr_staff_identity WHERE staff_id = $1 LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0];
    return row ? this.mapIdentity(row as Record<string, unknown>) : null;
  }

  async upsertIdentity(staffId: number, body: PatchHrStaffIdentityBody): Promise<HrStaffIdentityRow> {
    const existing = await this.getIdentity(staffId);
    const merged = {
      legal_name: body.legal_name ?? existing?.legal_name ?? '',
      dob: body.dob !== undefined ? body.dob : (existing?.dob ?? null),
      gender: body.gender ?? existing?.gender ?? '',
      nationality: body.nationality ?? existing?.nationality ?? 'VN',
      cccd: body.cccd ?? existing?.cccd ?? '',
      cccd_issued_on:
        body.cccd_issued_on !== undefined ? body.cccd_issued_on : (existing?.cccd_issued_on ?? null),
      cccd_issued_by: body.cccd_issued_by ?? existing?.cccd_issued_by ?? '',
      tax_code: body.tax_code ?? existing?.tax_code ?? '',
      bank_name: body.bank_name ?? existing?.bank_name ?? '',
      bank_account: body.bank_account ?? existing?.bank_account ?? '',
      bank_holder: body.bank_holder ?? existing?.bank_holder ?? '',
      timeclock_pin: body.timeclock_pin ?? existing?.timeclock_pin ?? '',
    };

    const cccd = String(merged.cccd ?? '').trim();
    if (cccd && !/^\d{12}$/.test(cccd)) {
      throw new BadRequestException({ error: 'invalid_cccd', message: 'CCCD phải 12 chữ số' });
    }
    const taxCode = String(merged.tax_code ?? '').trim();
    if (taxCode && !/^\d{10}(\d{3})?$/.test(taxCode)) {
      throw new BadRequestException({ error: 'invalid_tax_code', message: 'MST không hợp lệ' });
    }

    if (cccd) {
      const dup = await this.db.query(
        `SELECT staff_id::int FROM hr_staff_identity
         WHERE cccd = $1 AND staff_id <> $2
         LIMIT 1`,
        [cccd, staffId],
      );
      if (dup.rows[0]) {
        throw new BadRequestException({ error: 'cccd_duplicate', message: 'CCCD đã tồn tại' });
      }
    }

    const result = await this.db.query(
      `INSERT INTO hr_staff_identity
         (staff_id, legal_name, dob, gender, nationality, cccd, cccd_issued_on, cccd_issued_by,
          tax_code, bank_name, bank_account, bank_holder, timeclock_pin)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (staff_id) DO UPDATE SET
         legal_name = EXCLUDED.legal_name,
         dob = EXCLUDED.dob,
         gender = EXCLUDED.gender,
         nationality = EXCLUDED.nationality,
         cccd = EXCLUDED.cccd,
         cccd_issued_on = EXCLUDED.cccd_issued_on,
         cccd_issued_by = EXCLUDED.cccd_issued_by,
         tax_code = EXCLUDED.tax_code,
         bank_name = EXCLUDED.bank_name,
         bank_account = EXCLUDED.bank_account,
         bank_holder = EXCLUDED.bank_holder,
         timeclock_pin = EXCLUDED.timeclock_pin,
         updated_at = NOW()
       RETURNING ${IDENTITY_SELECT}`,
      [
        staffId,
        merged.legal_name,
        merged.dob || null,
        merged.gender,
        merged.nationality,
        cccd,
        merged.cccd_issued_on || null,
        merged.cccd_issued_by,
        taxCode,
        merged.bank_name,
        merged.bank_account,
        merged.bank_holder,
        merged.timeclock_pin,
      ],
    );
    return this.mapIdentity(result.rows[0] as Record<string, unknown>);
  }

  async listAddresses(staffId: number): Promise<HrStaffAddressRow[]> {
    const result = await this.db.query(
      `SELECT ${ADDRESS_SELECT}
       FROM hr_staff_addresses
       WHERE staff_id = $1
       ORDER BY CASE kind
         WHEN 'permanent' THEN 1
         WHEN 'temporary' THEN 2
         ELSE 3
       END, id`,
      [staffId],
    );
    return result.rows.map((row) => this.mapAddress(row as Record<string, unknown>));
  }

  async putAddresses(
    staffId: number,
    inputs: PutHrStaffAddressInput[],
  ): Promise<HrStaffAddressRow[]> {
    const permanent = inputs.find((a) => a.kind === 'permanent');
    const normalized = inputs.map((input) => {
      if (input.kind !== 'temporary') return input;
      if (!input.same_as_permanent || !permanent) return input;
      return {
        ...input,
        province_code: permanent.province_code ?? '',
        district_code: permanent.district_code ?? '',
        ward_code: permanent.ward_code ?? '',
        line1: permanent.line1 ?? '',
        same_as_permanent: true,
      };
    });

    for (const input of normalized) {
      const kind = String(input.kind ?? '').trim();
      if (!['permanent', 'temporary', 'contact'].includes(kind)) {
        throw new BadRequestException({ error: 'invalid_address_kind', kind });
      }
      await this.db.query(
        `INSERT INTO hr_staff_addresses
           (staff_id, kind, province_code, district_code, ward_code, line1, same_as_permanent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (staff_id, kind) DO UPDATE SET
           province_code = EXCLUDED.province_code,
           district_code = EXCLUDED.district_code,
           ward_code = EXCLUDED.ward_code,
           line1 = EXCLUDED.line1,
           same_as_permanent = EXCLUDED.same_as_permanent,
           updated_at = NOW()`,
        [
          staffId,
          kind,
          String(input.province_code ?? ''),
          String(input.district_code ?? ''),
          String(input.ward_code ?? ''),
          String(input.line1 ?? ''),
          Boolean(input.same_as_permanent),
        ],
      );
    }

    return this.listAddresses(staffId);
  }

  async logPiiAudit(input: {
    staffId: number;
    actorUserId: string | null;
    actorEmail: string;
    action: string;
    section: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    if (!(await this.tablesReady())) return;
    await this.db.query(
      `INSERT INTO hr_staff_pii_audit
         (staff_id, actor_user_id, actor_email, action, section, meta_json)
       VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb)`,
      [
        input.staffId,
        input.actorUserId,
        input.actorEmail,
        input.action,
        input.section,
        JSON.stringify(input.meta ?? {}),
      ],
    );
  }

  async assertStaffExists(staffId: number): Promise<HrStaffProfileStaffSummary> {
    const staff = await this.getStaffSummary(staffId);
    if (!staff) throw new NotFoundException({ error: 'staff_not_found', id: staffId });
    return staff;
  }
}
