import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PayrollPgRepository } from './payroll-pg.repository';
import { PayrollSqliteRepository } from './payroll-sqlite.repository';
import { buildPayrollXlsx } from './payroll-export.util';

@Injectable()
export class PayrollService {
  constructor(
    private readonly sqlite: PayrollSqliteRepository,
    private readonly pg: PayrollPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get repo(): PayrollSqliteRepository | PayrollPgRepository {
    return this.config.crmPayrollPg ? this.pg : this.sqlite;
  }

  dashboard(yearRaw?: string, monthRaw?: string) {
    const { year, month } = this.parseYearMonth(yearRaw, monthRaw, true);
    return this.repo.fetchDashboard(year, month);
  }

  getPolicy() {
    return this.repo.getPolicy();
  }

  updatePolicy(body: Record<string, unknown>) {
    return this.repo.updatePolicy(body ?? {});
  }

  getPositionRates() {
    return this.repo.getPositionRates();
  }

  updatePositionRates(body: Record<string, unknown>) {
    const items = body?.positions;
    if (!Array.isArray(items)) {
      throw new BadRequestException({ error: 'Cần mảng positions' });
    }
    return this.repo.updatePositionRates(items);
  }

  getPayroll(yearRaw?: string, monthRaw?: string) {
    const { year, month } = this.parseYearMonth(yearRaw, monthRaw);
    return this.repo.getPayroll(year, month);
  }

  computePayroll(body: Record<string, unknown>) {
    const { year, month } = this.parseYearMonthFromPayload(body);
    try {
      return this.repo.computePayroll(year, month);
    } catch (err) {
      if (err instanceof Error && err.message === 'PAYROLL_LOCKED') {
        throw new ConflictException({
          error: 'Kỳ lương đã khóa. Đặt về nháp (PATCH) để tính lại.',
        });
      }
      throw err;
    }
  }

  patchPayroll(payrollId: number, body: Record<string, unknown>) {
    const updated = this.repo.patchPayroll(payrollId, body ?? {});
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy kỳ lương' });
    }
    return updated;
  }

  patchPayrollLine(lineId: number, body: Record<string, unknown>) {
    try {
      const updated = this.repo.patchPayrollLine(lineId, body ?? {});
      if (!updated) {
        throw new NotFoundException({ error: 'Không tìm thấy dòng lương' });
      }
      return updated;
    } catch (err) {
      if (err instanceof Error && err.message === 'PAYROLL_LOCKED') {
        throw new ConflictException({ error: 'Kỳ lương đã khóa' });
      }
      throw err;
    }
  }

  exportPayroll(query: Record<string, string | undefined>) {
    const parsed = this.parseExportPeriod(query);
    let staffId: number | undefined;
    const staffRaw = String(query.staff_id ?? '').trim();
    if (staffRaw) {
      const n = Number(staffRaw);
      if (!Number.isFinite(n)) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      if (n > 0) staffId = n;
    }
    let staffQ = String(query.q ?? '').trim();
    if (staffId != null && staffQ) staffQ = '';
    const bundle = this.repo.exportPayrollBundle({
      period: parsed.period,
      y0: parsed.y0,
      m0: parsed.m0,
      y1: parsed.y1,
      m1: parsed.m1,
      staffId,
      staffQ: staffQ || undefined,
    });
    if (bundle.row_count === 0) {
      const periodHint =
        parsed.period === 'month'
          ? `${String(parsed.m0).padStart(2, '0')}/${parsed.y0}`
          : `${String(parsed.m0).padStart(2, '0')}/${parsed.y0}–${String(parsed.m1).padStart(2, '0')}/${parsed.y1}`;
      throw new BadRequestException({
        error: `Không có dữ liệu lương cho kỳ ${periodHint}. Hãy chọn đúng Năm/Tháng, bấm «Tính / cập nhật lương» rồi xuất lại.`,
      });
    }
    return bundle;
  }

  async exportPayrollXlsx(query: Record<string, string | undefined>) {
    const bundle = this.exportPayroll(query);
    return buildPayrollXlsx(bundle);
  }

  listMyPayslips(staffId: number) {
    return { ok: true, payslips: this.repo.listMyPayslips(staffId), read_only: true as const };
  }

  exportMyPayslipXlsx(staffId: number, year: number, month: number) {
    const bundle = this.repo.exportPayrollBundle({
      period: 'month',
      y0: year,
      m0: month,
      y1: year,
      m1: month,
      staffId,
    });
    if (bundle.row_count === 0) {
      throw new Error('PAYSLIP_NOT_FOUND');
    }
    return buildPayrollXlsx(bundle);
  }

  parseYearMonthPublic(yearRaw?: string, monthRaw?: string): { year: number; month: number } {
    return this.parseYearMonth(yearRaw, monthRaw, true);
  }

  listAttendance(query: Record<string, string | undefined>) {
    let staffId: number | undefined;
    const staffRaw = String(query.staff_id ?? '').trim();
    if (staffRaw) {
      const n = Number(staffRaw);
      if (!Number.isFinite(n)) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      if (n > 0) staffId = n;
    }
    const dateFrom = String(query.from ?? '').trim();
    const dateTo = String(query.to ?? '').trim();
    if (dateFrom && !this.validateDateYmd(dateFrom)) {
      throw new BadRequestException({ error: 'from phải là YYYY-MM-DD' });
    }
    if (dateTo && !this.validateDateYmd(dateTo)) {
      throw new BadRequestException({ error: 'to phải là YYYY-MM-DD' });
    }
    return this.repo.listAttendance({
      staffId,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  private parseYearMonth(
    yearRaw?: string,
    monthRaw?: string,
    defaultNow = false,
  ): { year: number; month: number } {
    const now = new Date();
    const year = Number(yearRaw ?? (defaultNow ? now.getFullYear() : 0));
    const month = Number(monthRaw ?? (defaultNow ? now.getMonth() + 1 : 0));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      throw new BadRequestException({ error: 'year/month không hợp lệ' });
    }
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      throw new BadRequestException({ error: 'Kỳ không hợp lệ' });
    }
    return { year, month };
  }

  private parseYearMonthFromPayload(body: Record<string, unknown>): { year: number; month: number } {
    const year = Number(body.year ?? 0);
    const month = Number(body.month ?? 0);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      throw new BadRequestException({ error: 'year/month không hợp lệ' });
    }
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      throw new BadRequestException({ error: 'Kỳ không hợp lệ' });
    }
    return { year, month };
  }

  private validateDateYmd(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y!, m! - 1, d!);
    return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d;
  }

  private parseExportPeriod(query: Record<string, string | undefined>): {
    period: string;
    y0: number;
    m0: number;
    y1: number;
    m1: number;
  } {
    let period = String(query.period ?? 'month').trim().toLowerCase();
    if (period !== 'month' && period !== 'quarter' && period !== 'range') {
      period = 'month';
    }
    const year = Number(query.year ?? 0);
    if (period === 'month') {
      const month = Number(query.month ?? 0);
      if (!Number.isFinite(year) || year < 2000 || year > 2100 || month < 1 || month > 12) {
        throw new BadRequestException({ error: 'Cần year và month hợp lệ (kỳ tháng)' });
      }
      return { period, y0: year, m0: month, y1: year, m1: month };
    }
    if (period === 'quarter') {
      const quarter = Number(query.quarter ?? 0);
      if (!Number.isFinite(year) || year < 2000 || year > 2100 || quarter < 1 || quarter > 4) {
        throw new BadRequestException({ error: 'Cần year và quarter (1–4) hợp lệ' });
      }
      const m0 = (quarter - 1) * 3 + 1;
      const m1 = m0 + 2;
      return { period, y0: year, m0, y1: year, m1 };
    }
    const from = String(query.from ?? '').trim();
    const to = String(query.to ?? '').trim();
    if (!this.validateDateYmd(from) || !this.validateDateYmd(to)) {
      throw new BadRequestException({ error: 'Cần from/to YYYY-MM-DD hợp lệ (kỳ range)' });
    }
    const [y0, m0] = from.split('-').map(Number);
    const [y1, m1] = to.split('-').map(Number);
    return { period, y0: y0!, m0: m0!, y1: y1!, m1: m1! };
  }
}
