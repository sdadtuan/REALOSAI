import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  computeStaffPayrollCore,
  countWorkdaysInMonthFromPolicy,
  defaultWeekdayShifts,
  enrichAttendanceRow,
  expectedStandardHoursInMonth,
  normalizeWeekdayShifts,
  parseWorkWeekdays,
  payrollExportFilename,
  payrollExportRowValues,
  payrollExportSummaryRows,
  PAYROLL_EXPORT_HEADERS,
  PAYROLL_EXPORT_SUMMARY_HEADERS,
  policyForApi,
  workWeekdaysFromShifts,
  weekdayShiftsJson,
  analyzeAttendanceDay,
  type PolicyRecord,
  type PositionPayrollRow,
} from './payroll-engine';

function rowDict(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v;
  return out;
}

function sortPositionRows(posMap: Record<number, PositionPayrollRow>): PositionPayrollRow[] {
  return Object.values(posMap).sort((a, b) => {
    const ra = Number(a.rank_level ?? 0);
    const rb = Number(b.rank_level ?? 0);
    if (ra !== rb) return ra - rb;
    return String(a.position_code ?? '').localeCompare(String(b.position_code ?? ''), 'vi');
  });
}

@Injectable()
export class PayrollPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

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
  }

  private async tableExists(name: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [name],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async loadPolicy(): Promise<PolicyRecord> {
    const result = await this.db.query(`SELECT * FROM crm_payroll_policy WHERE id = 1`);
    const row = result.rows[0];
    return row ? { ...row } : {};
  }

  private async loadPositionPayrollMap(): Promise<Record<number, PositionPayrollRow>> {
    const result = await this.db.query(
      `SELECT pp.*, p.code AS position_code, p.name AS position_name
       FROM crm_position_payroll pp
       JOIN crm_positions p ON p.id = pp.position_id
       WHERE p.active = true
       ORDER BY pp.rank_level ASC, p.sort_order ASC`,
    );
    const out: Record<number, PositionPayrollRow> = {};
    for (const r of result.rows) out[Number(r.position_id)] = { ...r };
    return out;
  }

  async getPolicy(): Promise<Record<string, unknown>> {
    const policy = await this.loadPolicy();
    return { policy: policyForApi(policy) };
  }

  async updatePolicy(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const intField = (key: string, def: number, lo: number, hi: number): number => {
      const v = Number(payload[key] ?? def);
      if (!Number.isFinite(v)) return def;
      return Math.max(lo, Math.min(v, hi));
    };
    const floatField = (key: string, def: number, lo: number, hi: number): number => {
      const v = Number(payload[key] ?? def);
      if (!Number.isFinite(v)) return def;
      return Math.max(lo, Math.min(v, hi));
    };
    const rawShifts = payload.weekday_shifts;
    let shifts;
    if (Array.isArray(rawShifts) && rawShifts.length > 0) {
      shifts = normalizeWeekdayShifts(rawShifts);
    } else {
      const workSet = parseWorkWeekdays(String(payload.work_weekdays ?? '0,1,2,3,4'));
      shifts = defaultWeekdayShifts({
        workWeekdays: workSet,
        shiftStart: String(payload.shift_start ?? '08:30').trim().slice(0, 5),
        shiftEnd: String(payload.shift_end ?? '17:30').trim().slice(0, 5),
        breakMinutes: intField('break_minutes_default', 60, 0, 24 * 60),
        standardHours: floatField('standard_hours_per_day', 8.0, 0.5, 24.0),
      });
    }
    const weekdaysRaw = workWeekdaysFromShifts(shifts);
    const shiftsJson = weekdayShiftsJson(shifts);
    const firstWork = shifts.find((s) => s.work) ?? shifts[0]!;
    const shiftStart = String(firstWork.shift_start ?? '08:30').trim().slice(0, 5);
    const shiftEnd = String(firstWork.shift_end ?? '17:30').trim().slice(0, 5);
    const breakDefault = Math.max(0, Math.min(Number(firstWork.break_minutes ?? 60), 24 * 60));
    const stdHoursDay = Math.max(0.5, Math.min(Number(firstWork.standard_hours ?? 8), 24.0));
    let bonusMode = String(payload.bonus_mode ?? 'attendance').trim().toLowerCase();
    if (bonusMode !== 'attendance' && bonusMode !== 'none') bonusMode = 'attendance';
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_payroll_policy SET
         work_weekdays = $1,
         shift_start = $2,
         shift_end = $3,
         break_minutes_default = $4,
         late_grace_minutes = $5,
         late_penalty_vnd_per_min = $6,
         late_penalty_max_vnd = $7,
         standard_hours_per_day = $8,
         bonus_mode = $9,
         bonus_pct = $10,
         bonus_min_days = $11,
         overtime_multiplier = $12,
         weekday_shifts = $13,
         updated_at = $14
       WHERE id = 1`,
      [
        weekdaysRaw,
        shiftStart,
        shiftEnd,
        breakDefault,
        intField('late_grace_minutes', 5, 0, 120),
        intField('late_penalty_vnd_per_min', 5000, 0, 50_000_000),
        intField('late_penalty_max_vnd', 200_000, 0, 500_000_000),
        stdHoursDay,
        bonusMode,
        floatField('bonus_pct', 5.0, 0.0, 100.0),
        intField('bonus_min_days', 20, 0, 31),
        floatField('overtime_multiplier', 1.5, 1.0, 3.0),
        shiftsJson,
        ts,
      ],
    );
    return this.getPolicy();
  }

  async getPositionRates(): Promise<{ positions: PositionPayrollRow[] }> {
    const posMap = await this.loadPositionPayrollMap();
    return { positions: sortPositionRows(posMap) };
  }

  async updatePositionRates(items: unknown[]): Promise<{ positions: PositionPayrollRow[] }> {
    await this.loadPolicy();
    const ts = catalogTs();
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const pid = Number(rec.position_id ?? 0);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const posExists = await this.db.query('SELECT id FROM crm_positions WHERE id = $1', [pid]);
      if ((posExists.rowCount ?? 0) === 0) continue;
      let rank = Number(rec.rank_level ?? 1);
      if (!Number.isFinite(rank)) rank = 1;
      rank = Math.max(1, Math.min(rank, 99));
      let allow = Number(rec.allowance_vnd ?? 0);
      if (!Number.isFinite(allow)) allow = 0;
      allow = Math.max(0, Math.min(allow, 999_999_999));
      let bp = Number(rec.bonus_pct ?? 0);
      if (!Number.isFinite(bp)) bp = 0;
      bp = Math.max(0, Math.min(bp, 100.0));
      await this.db.query(
        `INSERT INTO crm_position_payroll (position_id, rank_level, allowance_vnd, bonus_pct, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (position_id) DO UPDATE SET
           rank_level = EXCLUDED.rank_level,
           allowance_vnd = EXCLUDED.allowance_vnd,
           bonus_pct = EXCLUDED.bonus_pct,
           updated_at = EXCLUDED.updated_at`,
        [pid, rank, allow, bp, ts],
      );
    }
    return this.getPositionRates();
  }

  async fetchDashboard(year: number, month: number): Promise<Record<string, unknown>> {
    const policy = await this.loadPolicy();
    if (!(await this.tableExists('crm_staff'))) {
      return {
        ...(await this.dashboardSummary(year, month, policy)),
        position_rates: [],
      };
    }
    const summary = await this.dashboardSummary(year, month, policy);
    const posMap = await this.loadPositionPayrollMap();
    return { ...summary, position_rates: sortPositionRows(posMap) };
  }

  private async dashboardSummary(
    year: number,
    month: number,
    policy: PolicyRecord,
  ): Promise<Record<string, unknown>> {
    const d0 = `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0).getDate();
    const d1 = `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const today = new Date().toISOString().slice(0, 10);
    const staffN = await this.db.query('SELECT COUNT(*)::int AS n FROM crm_staff WHERE active = true');
    const attMonth = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_attendance
       WHERE work_date >= $1 AND work_date <= $2
         AND TRIM(check_in) != '' AND TRIM(check_out) != ''`,
      [d0, d1],
    );
    const attToday = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_attendance
       WHERE work_date = $1 AND TRIM(check_in) != ''`,
      [today],
    );
    const attRows = await this.db.query(
      `SELECT work_date, check_in, check_out, break_minutes
       FROM crm_attendance WHERE work_date >= $1 AND work_date <= $2`,
      [d0, d1],
    );
    let lateCount = 0;
    let totalHours = 0;
    for (const r of attRows.rows) {
      const day = analyzeAttendanceDay({
        workDate: String(r.work_date),
        checkIn: String(r.check_in ?? ''),
        checkOut: String(r.check_out ?? ''),
        breakMinutes: Number(r.break_minutes ?? 0),
        policy,
      });
      if (Number(day.late_minutes) > 0) lateCount++;
      totalHours += Number(day.worked_hours);
    }
    const stdDays = countWorkdaysInMonthFromPolicy(year, month, policy);
    const stdHoursMonth = expectedStandardHoursInMonth(year, month, policy);
    return {
      year,
      month,
      staff_active: Number(staffN.rows[0]?.n ?? 0),
      attendance_records_month: Number(attMonth.rows[0]?.n ?? 0),
      checked_in_today: Number(attToday.rows[0]?.n ?? 0),
      late_incidents_month: lateCount,
      total_hours_month: Math.round(totalHours * 10) / 10,
      workdays_standard: stdDays,
      standard_hours_month: Math.round(stdHoursMonth * 10) / 10,
      policy: policyForApi(policy),
    };
  }

  async getPayroll(
    year: number,
    month: number,
  ): Promise<{ payroll: Record<string, unknown> | null; lines: Record<string, unknown>[] }> {
    if (!(await this.tableExists('crm_payroll'))) {
      return { payroll: null, lines: [] };
    }
    const prResult = await this.db.query('SELECT * FROM crm_payroll WHERE year = $1 AND month = $2', [
      year,
      month,
    ]);
    const pr = prResult.rows[0];
    if (!pr) return { payroll: null, lines: [] };
    const linesResult = await this.db.query(
      `SELECT pl.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_payroll_line pl
       JOIN crm_staff s ON s.id = pl.staff_id
       WHERE pl.payroll_id = $1
       ORDER BY s.name ASC`,
      [Number(pr.id)],
    );
    return { payroll: rowDict(pr), lines: linesResult.rows.map(rowDict) };
  }

  async computePayroll(
    year: number,
    month: number,
  ): Promise<{ payroll: Record<string, unknown>; lines: Record<string, unknown>[] }> {
    const policy = await this.loadPolicy();
    const standard = countWorkdaysInMonthFromPolicy(year, month, policy);
    const ts = catalogTs();
    const prevResult = await this.db.query('SELECT * FROM crm_payroll WHERE year = $1 AND month = $2', [
      year,
      month,
    ]);
    const prev = prevResult.rows[0];
    if (prev != null && String(prev.status ?? '').trim() === 'final') {
      throw new Error('PAYROLL_LOCKED');
    }
    let prRow: Record<string, unknown>;
    if (prev == null) {
      const insertResult = await this.db.query(
        `INSERT INTO crm_payroll (year, month, workdays_standard, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'draft', $4, $5)
         RETURNING *`,
        [year, month, standard, ts, ts],
      );
      prRow = insertResult.rows[0]!;
    } else {
      await this.db.query('UPDATE crm_payroll SET workdays_standard = $1, updated_at = $2 WHERE id = $3', [
        standard,
        ts,
        Number(prev.id),
      ]);
      const rowResult = await this.db.query('SELECT * FROM crm_payroll WHERE id = $1', [Number(prev.id)]);
      prRow = rowResult.rows[0]!;
    }
    const pid = Number(prRow.id);
    const positionMap = await this.loadPositionPayrollMap();
    const staffResult = await this.db.query(
      `SELECT id, name, base_salary_vnd, position_id
       FROM crm_staff WHERE active = true ORDER BY name ASC`,
    );
    const d0 = `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0).getDate();
    const d1 = `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;

    for (const sr of staffResult.rows) {
      const stId = Number(sr.id);
      const base = Number(sr.base_salary_vnd ?? 0);
      const posId = sr.position_id != null ? Number(sr.position_id) : null;
      const attResult = await this.db.query(
        `SELECT work_date, check_in, check_out, break_minutes
         FROM crm_attendance
         WHERE staff_id = $1 AND work_date >= $2 AND work_date <= $3
         ORDER BY work_date ASC`,
        [stId, d0, d1],
      );
      const computed = computeStaffPayrollCore(attResult.rows, {
        baseSalaryVnd: base,
        positionId: posId,
        year,
        month,
        policy,
        positionMap,
      });
      const existingResult = await this.db.query(
        `SELECT id, allowances_vnd, deductions_vnd, note,
                position_allowance_vnd, bonus_vnd, late_deduction_vnd
         FROM crm_payroll_line WHERE payroll_id = $1 AND staff_id = $2`,
        [pid, stId],
      );
      const existing = existingResult.rows[0];
      const autoAllow = Number(computed.position_allowance_vnd) + Number(computed.bonus_vnd);
      const autoDed = Number(computed.late_deduction_vnd);
      let manualAllow = 0;
      let manualDed = 0;
      let note = '';
      if (existing) {
        note = String(existing.note ?? '');
        const prevAutoAllow =
          Number(existing.position_allowance_vnd ?? 0) + Number(existing.bonus_vnd ?? 0);
        const prevAutoDed = Number(existing.late_deduction_vnd ?? 0);
        manualAllow = Math.max(0, Number(existing.allowances_vnd ?? 0) - prevAutoAllow);
        manualDed = Math.max(0, Number(existing.deductions_vnd ?? 0) - prevAutoDed);
      }
      const allow = autoAllow + manualAllow;
      const ded = autoDed + manualDed;
      const salaryAtt = Number(computed.salary_from_attendance_vnd);
      const net = salaryAtt + allow - ded;
      const days = Number(computed.days_present);
      if (existing) {
        await this.db.query(
          `UPDATE crm_payroll_line SET
             days_present = $1, base_salary_vnd = $2, salary_from_attendance_vnd = $3,
             hours_worked_total = $4, late_minutes_total = $5, late_deduction_vnd = $6,
             position_allowance_vnd = $7, bonus_vnd = $8,
             allowances_vnd = $9, deductions_vnd = $10, net_salary_vnd = $11, updated_at = $12
           WHERE id = $13`,
          [
            days,
            base,
            salaryAtt,
            Number(computed.hours_worked_total),
            Number(computed.late_minutes_total),
            Number(computed.late_deduction_vnd),
            Number(computed.position_allowance_vnd),
            Number(computed.bonus_vnd),
            allow,
            ded,
            net,
            ts,
            Number(existing.id),
          ],
        );
      } else {
        await this.db.query(
          `INSERT INTO crm_payroll_line (
             payroll_id, staff_id, days_present, base_salary_vnd,
             salary_from_attendance_vnd, hours_worked_total, late_minutes_total,
             late_deduction_vnd, position_allowance_vnd, bonus_vnd,
             allowances_vnd, deductions_vnd, net_salary_vnd,
             note, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            pid,
            stId,
            days,
            base,
            salaryAtt,
            Number(computed.hours_worked_total),
            Number(computed.late_minutes_total),
            Number(computed.late_deduction_vnd),
            Number(computed.position_allowance_vnd),
            Number(computed.bonus_vnd),
            allow,
            ded,
            net,
            note,
            ts,
            ts,
          ],
        );
      }
    }
    return (await this.getPayroll(year, month)) as {
      payroll: Record<string, unknown>;
      lines: Record<string, unknown>[];
    };
  }

  async patchPayroll(
    payrollId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const rowResult = await this.db.query('SELECT * FROM crm_payroll WHERE id = $1', [payrollId]);
    const row = rowResult.rows[0];
    if (!row) return null;
    let status = String(row.status ?? 'draft');
    if ('status' in payload) {
      const s = String(payload.status ?? '').trim().toLowerCase();
      if (s === 'draft' || s === 'final') status = s;
    }
    const ts = catalogTs();
    await this.db.query('UPDATE crm_payroll SET status = $1, updated_at = $2 WHERE id = $3', [
      status,
      ts,
      payrollId,
    ]);
    const row2Result = await this.db.query('SELECT * FROM crm_payroll WHERE id = $1', [payrollId]);
    const row2 = row2Result.rows[0];
    return row2 ? rowDict(row2) : null;
  }

  async patchPayrollLine(
    lineId: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const lineResult = await this.db.query('SELECT * FROM crm_payroll_line WHERE id = $1', [lineId]);
    const line = lineResult.rows[0];
    if (!line) return null;
    const prResult = await this.db.query('SELECT * FROM crm_payroll WHERE id = $1', [Number(line.payroll_id)]);
    const pr = prResult.rows[0];
    if (pr != null && String(pr.status ?? '').trim() === 'final') {
      throw new Error('PAYROLL_LOCKED');
    }
    let allow = Number(line.allowances_vnd ?? 0);
    let ded = Number(line.deductions_vnd ?? 0);
    let note = String(line.note ?? '');
    if ('allowances_vnd' in payload) {
      const v = Number(payload.allowances_vnd);
      if (Number.isFinite(v)) allow = Math.max(0, Math.min(v, 9_999_999_999));
    }
    if ('deductions_vnd' in payload) {
      const v = Number(payload.deductions_vnd);
      if (Number.isFinite(v)) ded = Math.max(0, Math.min(v, 9_999_999_999));
    }
    if ('note' in payload && typeof payload.note === 'string') {
      note = payload.note.trim().slice(0, 2000);
    }
    const sat = Number(line.salary_from_attendance_vnd ?? 0);
    const net = sat + allow - ded;
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_payroll_line
       SET allowances_vnd = $1, deductions_vnd = $2, net_salary_vnd = $3, note = $4, updated_at = $5
       WHERE id = $6`,
      [allow, ded, net, note, ts, lineId],
    );
    const row2Result = await this.db.query(
      `SELECT pl.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_payroll_line pl
       JOIN crm_staff s ON s.id = pl.staff_id
       WHERE pl.id = $1`,
      [lineId],
    );
    const row2 = row2Result.rows[0];
    return row2 ? rowDict(row2) : null;
  }

  private async findStaffIdsByQuery(query: string): Promise<number[]> {
    const q = String(query ?? '').trim();
    if (!q) {
      const rows = await this.db.query('SELECT id FROM crm_staff WHERE active = true');
      return rows.rows.map((r) => Number(r.id));
    }
    const like = `%${q}%`;
    const rows = await this.db.query(
      `SELECT id FROM crm_staff WHERE active = true AND (
         name ILIKE $1 OR
         internal_code ILIKE $1 OR
         attendance_pin LIKE $2
       )`,
      [like, like],
    );
    return rows.rows.map((r) => Number(r.id));
  }

  private async fetchExportRows(opts: {
    y0: number;
    m0: number;
    y1: number;
    m1: number;
    staffId?: number;
    staffQ?: string;
  }): Promise<Record<string, unknown>[]> {
    if (!(await this.tableExists('crm_payroll')) || !(await this.tableExists('crm_payroll_line'))) {
      return [];
    }
    const clauses = [
      '(p.year > $1 OR (p.year = $2 AND p.month >= $3))',
      '(p.year < $4 OR (p.year = $5 AND p.month <= $6))',
    ];
    const params: (string | number)[] = [opts.y0, opts.y0, opts.m0, opts.y1, opts.y1, opts.m1];
    let paramIdx = 7;
    if (opts.staffId != null) {
      clauses.push(`pl.staff_id = $${paramIdx}`);
      params.push(opts.staffId);
      paramIdx += 1;
    } else if (opts.staffQ) {
      const staffIds = await this.findStaffIdsByQuery(opts.staffQ);
      if (staffIds.length === 0) return [];
      clauses.push(`pl.staff_id IN (${staffIds.map((_, i) => `$${paramIdx + i}`).join(',')})`);
      params.push(...staffIds);
    }
    const whereSql = clauses.join(' AND ');
    const rows = await this.db.query(
      `SELECT pl.*,
              s.name AS staff_name, s.internal_code AS staff_code,
              p.year AS payroll_year, p.month AS payroll_month,
              p.status AS payroll_status, p.workdays_standard
       FROM crm_payroll_line pl
       JOIN crm_payroll p ON p.id = pl.payroll_id
       JOIN crm_staff s ON s.id = pl.staff_id
       WHERE ${whereSql}
       ORDER BY p.year ASC, p.month ASC, s.name ASC`,
      params,
    );
    return rows.rows.map(rowDict);
  }

  async listMyPayslips(staffId: number): Promise<Array<Record<string, unknown>>> {
    if (!(await this.tableExists('crm_payroll_line')) || !(await this.tableExists('crm_payroll'))) {
      return [];
    }
    const rows = await this.db.query(
      `SELECT p.id AS payroll_id, p.year, p.month, p.status AS payroll_status,
              pl.net_salary_vnd AS net_pay,
              pl.salary_from_attendance_vnd AS gross_pay,
              pl.deductions_vnd AS total_deductions,
              pl.days_present AS workdays_actual
       FROM crm_payroll_line pl
       JOIN crm_payroll p ON p.id = pl.payroll_id
       WHERE pl.staff_id = $1
       ORDER BY p.year DESC, p.month DESC
       LIMIT 24`,
      [staffId],
    );
    return rows.rows.map(rowDict);
  }

  async exportPayrollBundle(opts: {
    period: string;
    y0: number;
    m0: number;
    y1: number;
    m1: number;
    staffId?: number;
    staffQ?: string;
  }): Promise<Record<string, unknown>> {
    const rows = await this.fetchExportRows(opts);
    const includeSummary =
      opts.period === 'quarter' ||
      opts.period === 'range' ||
      opts.y0 !== opts.y1 ||
      opts.m0 !== opts.m1;
    const filename = payrollExportFilename(opts.period, opts.y0, opts.m0, opts.y1, opts.m1);
    return {
      period: opts.period,
      from: { year: opts.y0, month: opts.m0 },
      to: { year: opts.y1, month: opts.m1 },
      filename,
      headers: PAYROLL_EXPORT_HEADERS,
      rows: rows.map(payrollExportRowValues),
      include_summary: includeSummary,
      summary_headers: PAYROLL_EXPORT_SUMMARY_HEADERS,
      summary_rows: includeSummary && rows.length > 0 ? payrollExportSummaryRows(rows) : [],
      row_count: rows.length,
    };
  }

  async listAttendance(opts: {
    staffId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ attendance: Record<string, unknown>[] }> {
    if (!(await this.tableExists('crm_attendance'))) {
      return { attendance: [] };
    }
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;
    if (opts.staffId != null) {
      clauses.push(`a.staff_id = $${idx++}`);
      params.push(opts.staffId);
    }
    if (opts.dateFrom) {
      clauses.push(`a.work_date >= $${idx++}`);
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      clauses.push(`a.work_date <= $${idx++}`);
      params.push(opts.dateTo);
    }
    const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.db.query(
      `SELECT a.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_attendance a
       JOIN crm_staff s ON s.id = a.staff_id
       ${whereSql}
       ORDER BY a.work_date DESC, s.name ASC`,
      params,
    );
    const policy = await this.loadPolicy();
    return {
      attendance: rows.rows.map((r) => enrichAttendanceRow(rowDict(r), policy)),
    };
  }

  async pgPolicyReady(): Promise<boolean> {
    try {
      const result = await this.db.query(`SELECT 1 FROM crm_payroll_policy WHERE id = 1 LIMIT 1`);
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async readPolicyFromPg(): Promise<Record<string, unknown> | null> {
    if (!(await this.pgPolicyReady())) return null;
    const result = await this.db.query(`SELECT * FROM crm_payroll_policy WHERE id = 1`);
    const row = result.rows[0];
    if (!row) return null;
    return { policy: policyForApi(row as Record<string, unknown>) };
  }
}
