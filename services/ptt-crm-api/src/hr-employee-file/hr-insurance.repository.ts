import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateHrInsurancePeriodBody,
  HrInsurancePeriodRow,
  HrInsuranceSummary,
  HrStaffInsuranceRow,
  PatchHrInsurancePeriodBody,
  PutHrStaffInsuranceBody,
} from './hr-insurance.types';
import { emptyInsuranceRow, isBhytExpiringSoon } from './hr-insurance.util';

const INSURANCE_SELECT = `
  i.staff_id::int,
  i.bhxh_book_no, i.bhxh_joined_on::text, i.bhxh_status, i.bhxh_document_id::int,
  wb.title AS bhxh_document_title,
  i.bhyt_card_no, i.bhyt_valid_from::text, i.bhyt_valid_to::text, i.bhyt_clinic_name,
  i.bhyt_document_id::int, wy.title AS bhyt_document_title,
  i.bhtn_joined_on::text, i.bhtn_status, i.bhtn_document_id::int, wt.title AS bhtn_document_title,
  i.notes, i.created_at::text, i.updated_at::text
`;

@Injectable()
export class HrInsuranceRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readyCache: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.readyCache = null;
  }

  async tablesReady(): Promise<boolean> {
    if (this.readyCache != null) return this.readyCache;
    try {
      await this.db.query(`SELECT 1 FROM hr_staff_insurance LIMIT 1`);
      this.readyCache = true;
    } catch {
      this.readyCache = false;
    }
    return this.readyCache;
  }

  private mapInsurance(row: Record<string, unknown>): HrStaffInsuranceRow {
    return {
      staff_id: Number(row.staff_id),
      bhxh_book_no: String(row.bhxh_book_no ?? ''),
      bhxh_joined_on: row.bhxh_joined_on ? String(row.bhxh_joined_on).slice(0, 10) : null,
      bhxh_status: String(row.bhxh_status ?? 'active') as HrStaffInsuranceRow['bhxh_status'],
      bhxh_document_id: row.bhxh_document_id == null ? null : Number(row.bhxh_document_id),
      bhxh_document_title: row.bhxh_document_title ? String(row.bhxh_document_title) : null,
      bhyt_card_no: String(row.bhyt_card_no ?? ''),
      bhyt_valid_from: row.bhyt_valid_from ? String(row.bhyt_valid_from).slice(0, 10) : null,
      bhyt_valid_to: row.bhyt_valid_to ? String(row.bhyt_valid_to).slice(0, 10) : null,
      bhyt_clinic_name: String(row.bhyt_clinic_name ?? ''),
      bhyt_document_id: row.bhyt_document_id == null ? null : Number(row.bhyt_document_id),
      bhyt_document_title: row.bhyt_document_title ? String(row.bhyt_document_title) : null,
      bhtn_joined_on: row.bhtn_joined_on ? String(row.bhtn_joined_on).slice(0, 10) : null,
      bhtn_status: String(row.bhtn_status ?? 'active') as HrStaffInsuranceRow['bhtn_status'],
      bhtn_document_id: row.bhtn_document_id == null ? null : Number(row.bhtn_document_id),
      bhtn_document_title: row.bhtn_document_title ? String(row.bhtn_document_title) : null,
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapPeriod(row: Record<string, unknown>): HrInsurancePeriodRow {
    return {
      id: Number(row.id),
      staff_id: Number(row.staff_id),
      kind: String(row.kind ?? 'bhxh') as HrInsurancePeriodRow['kind'],
      period_year: Number(row.period_year),
      period_month: Number(row.period_month),
      salary_base: row.salary_base == null ? null : Number(row.salary_base),
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private async assertWalletCard(staffId: number, documentId: number | null | undefined): Promise<void> {
    if (documentId == null) return;
    const result = await this.db.query(
      `SELECT 1 FROM hr_doc_wallet WHERE id = $1 AND staff_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [documentId, staffId],
    );
    if (!result.rows[0]) {
      throw new BadRequestException({ error: 'invalid_document_id', document_id: documentId });
    }
  }

  async getForStaff(staffId: number): Promise<HrStaffInsuranceRow> {
    const result = await this.db.query(
      `SELECT ${INSURANCE_SELECT}
       FROM hr_staff_insurance i
       LEFT JOIN hr_doc_wallet wb ON wb.id = i.bhxh_document_id AND wb.deleted_at IS NULL
       LEFT JOIN hr_doc_wallet wy ON wy.id = i.bhyt_document_id AND wy.deleted_at IS NULL
       LEFT JOIN hr_doc_wallet wt ON wt.id = i.bhtn_document_id AND wt.deleted_at IS NULL
       WHERE i.staff_id = $1
       LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0];
    if (!row) return emptyInsuranceRow(staffId);
    return this.mapInsurance(row as Record<string, unknown>);
  }

  async getSummary(staffId: number): Promise<HrInsuranceSummary | null> {
    const result = await this.db.query(
      `SELECT bhyt_valid_to::text FROM hr_staff_insurance WHERE staff_id = $1 LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const validTo = row.bhyt_valid_to ? String(row.bhyt_valid_to).slice(0, 10) : null;
    return { bhyt_valid_to: validTo, bhyt_expiring_soon: isBhytExpiringSoon(validTo) };
  }

  async listPeriods(staffId: number): Promise<HrInsurancePeriodRow[]> {
    const result = await this.db.query(
      `SELECT id::int, staff_id::int, kind, period_year::int, period_month::int,
              salary_base::float8, notes, created_at::text, updated_at::text
       FROM hr_insurance_periods
       WHERE staff_id = $1
       ORDER BY period_year DESC, period_month DESC, id DESC`,
      [staffId],
    );
    return result.rows.map((r) => this.mapPeriod(r as Record<string, unknown>));
  }

  async upsert(staffId: number, body: PutHrStaffInsuranceBody): Promise<HrStaffInsuranceRow> {
    for (const docId of [body.bhxh_document_id, body.bhyt_document_id, body.bhtn_document_id]) {
      if (docId !== undefined) await this.assertWalletCard(staffId, docId);
    }
    await this.db.query(
      `INSERT INTO hr_staff_insurance (
         staff_id, bhxh_book_no, bhxh_joined_on, bhxh_status, bhxh_document_id,
         bhyt_card_no, bhyt_valid_from, bhyt_valid_to, bhyt_clinic_name, bhyt_document_id,
         bhtn_joined_on, bhtn_status, bhtn_document_id, notes
       ) VALUES (
         $1, $2, $3::date, $4, $5, $6, $7::date, $8::date, $9, $10, $11::date, $12, $13, $14
       )
       ON CONFLICT (staff_id) DO UPDATE SET
         bhxh_book_no = COALESCE(EXCLUDED.bhxh_book_no, hr_staff_insurance.bhxh_book_no),
         bhxh_joined_on = COALESCE(EXCLUDED.bhxh_joined_on, hr_staff_insurance.bhxh_joined_on),
         bhxh_status = COALESCE(EXCLUDED.bhxh_status, hr_staff_insurance.bhxh_status),
         bhxh_document_id = COALESCE(EXCLUDED.bhxh_document_id, hr_staff_insurance.bhxh_document_id),
         bhyt_card_no = COALESCE(EXCLUDED.bhyt_card_no, hr_staff_insurance.bhyt_card_no),
         bhyt_valid_from = COALESCE(EXCLUDED.bhyt_valid_from, hr_staff_insurance.bhyt_valid_from),
         bhyt_valid_to = COALESCE(EXCLUDED.bhyt_valid_to, hr_staff_insurance.bhyt_valid_to),
         bhyt_clinic_name = COALESCE(EXCLUDED.bhyt_clinic_name, hr_staff_insurance.bhyt_clinic_name),
         bhyt_document_id = COALESCE(EXCLUDED.bhyt_document_id, hr_staff_insurance.bhyt_document_id),
         bhtn_joined_on = COALESCE(EXCLUDED.bhtn_joined_on, hr_staff_insurance.bhtn_joined_on),
         bhtn_status = COALESCE(EXCLUDED.bhtn_status, hr_staff_insurance.bhtn_status),
         bhtn_document_id = COALESCE(EXCLUDED.bhtn_document_id, hr_staff_insurance.bhtn_document_id),
         notes = COALESCE(EXCLUDED.notes, hr_staff_insurance.notes),
         updated_at = NOW()`,
      [
        staffId,
        body.bhxh_book_no ?? '',
        body.bhxh_joined_on ?? null,
        body.bhxh_status ?? 'active',
        body.bhxh_document_id ?? null,
        body.bhyt_card_no ?? '',
        body.bhyt_valid_from ?? null,
        body.bhyt_valid_to ?? null,
        body.bhyt_clinic_name ?? '',
        body.bhyt_document_id ?? null,
        body.bhtn_joined_on ?? null,
        body.bhtn_status ?? 'active',
        body.bhtn_document_id ?? null,
        body.notes ?? '',
      ],
    );
    return this.getForStaff(staffId);
  }

  async createPeriod(staffId: number, body: CreateHrInsurancePeriodBody): Promise<HrInsurancePeriodRow> {
    const kind = String(body.kind ?? 'bhxh');
    const year = Number(body.period_year);
    const month = Number(body.period_month);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      throw new BadRequestException({ error: 'period_year_month_required' });
    }
    try {
      const result = await this.db.query(
        `INSERT INTO hr_insurance_periods (staff_id, kind, period_year, period_month, salary_base, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id::int, staff_id::int, kind, period_year::int, period_month::int,
                   salary_base::float8, notes, created_at::text, updated_at::text`,
        [staffId, kind, year, month, body.salary_base ?? null, String(body.notes ?? '')],
      );
      return this.mapPeriod(result.rows[0] as Record<string, unknown>);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        throw new BadRequestException({ error: 'period_duplicate', kind, period_year: year, period_month: month });
      }
      throw err;
    }
  }

  async patchPeriod(
    staffId: number,
    periodId: number,
    body: PatchHrInsurancePeriodBody,
  ): Promise<HrInsurancePeriodRow> {
    const result = await this.db.query(
      `UPDATE hr_insurance_periods SET
         kind = COALESCE($3, kind),
         period_year = COALESCE($4, period_year),
         period_month = COALESCE($5, period_month),
         salary_base = COALESCE($6, salary_base),
         notes = COALESCE($7, notes),
         updated_at = NOW()
       WHERE id = $1 AND staff_id = $2
       RETURNING id::int, staff_id::int, kind, period_year::int, period_month::int,
                 salary_base::float8, notes, created_at::text, updated_at::text`,
      [
        periodId,
        staffId,
        body.kind ?? null,
        body.period_year ?? null,
        body.period_month ?? null,
        body.salary_base ?? null,
        body.notes ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'period_not_found', id: periodId });
    return this.mapPeriod(result.rows[0] as Record<string, unknown>);
  }
}
