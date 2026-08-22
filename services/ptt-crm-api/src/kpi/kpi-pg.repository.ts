import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateKpiMetricBody,
  KpiMetricRow,
  PatchKpiMetricBody,
  PatchStaffKpiProgressBody,
  StaffKpiEntryRow,
  StaffKpiMetricItem,
  StaffKpiMetricsResponse,
  deriveKpiAlert,
  kpiAchievementPct,
  kpiAlertLabelVi,
  truthyFlag,
} from './kpi.types';
import { KPI_TEAM_DEPT_PATTERNS, type KpiTeamCode } from './kpi-team-filter.util';

@Injectable()
export class KpiPgRepository implements OnModuleDestroy {
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

  private monthRange(year: number, month: number): { start: string; end: string } {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return { start, end };
  }

  private async resolveStaff(
    staffId: number,
  ): Promise<{ pgId: number; sqliteId: number | null } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_staff_id FROM crm_staff
       WHERE id = $1 OR sqlite_staff_id = $1 LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0] as { id: number; sqlite_staff_id: number | null } | undefined;
    if (!row) return null;
    return {
      pgId: Number(row.id),
      sqliteId: row.sqlite_staff_id != null ? Number(row.sqlite_staff_id) : null,
    };
  }

  private staffIdVariants(
    pgId: number,
    sqliteId: number | null,
    inputId: number,
  ): number[] {
    const ids = new Set<number>([pgId, inputId]);
    if (sqliteId != null) ids.add(sqliteId);
    return [...ids];
  }

  async listMetrics(includeInactive: boolean): Promise<KpiMetricRow[]> {
    const sql = includeInactive
      ? `SELECT * FROM crm_kpi_metrics
         ORDER BY active DESC, sort_order ASC, lower(name) ASC`
      : `SELECT * FROM crm_kpi_metrics
         WHERE active = TRUE
         ORDER BY sort_order ASC, lower(name) ASC`;
    const result = await this.db.query(sql);
    return (result.rows as Array<Record<string, unknown>>).map((row) => this.mapMetricRow(row));
  }

  async getMetricById(metricId: number): Promise<KpiMetricRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_kpi_metrics WHERE id = $1`, [metricId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapMetricRow(row) : null;
  }

  async createMetric(body: CreateKpiMetricBody): Promise<KpiMetricRow> {
    const code = String(body.code ?? '').trim().slice(0, 64);
    const name = String(body.name ?? '').trim().slice(0, 240);
    const unit = String(body.unit ?? '').trim().slice(0, 64);
    const desc = String(body.description ?? '').trim().slice(0, 2000);
    let sortOrder = Number(body.sort_order ?? 0);
    if (!Number.isFinite(sortOrder)) sortOrder = 0;
    const hi = truthyFlag(body.higher_is_better);
    let warnRatio: number | null = null;
    if (body.warn_ratio != null) {
      const wr = Number(body.warn_ratio);
      if (Number.isFinite(wr)) warnRatio = wr;
    }

    if (code) {
      const dup = await this.db.query(
        `SELECT 1 FROM crm_kpi_metrics
         WHERE lower(trim(code)) = lower($1) AND trim(code) != ''`,
        [code],
      );
      if (dup.rows.length > 0) throw new Error('DUPLICATE_CODE');
    }

    const result = await this.db.query(
      `INSERT INTO crm_kpi_metrics (
         code, name, unit, description, sort_order, active,
         created_at, updated_at, higher_is_better, warn_ratio
       ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW(), $6, $7)
       RETURNING *`,
      [code, name, unit, desc, sortOrder, hi, warnRatio],
    );
    const metric = this.mapMetricRow(result.rows[0] as Record<string, unknown>);
    if (!metric) throw new Error('Failed to create KPI metric');
    return metric;
  }

  async patchMetric(metricId: number, body: PatchKpiMetricBody): Promise<KpiMetricRow | null> {
    const existing = await this.getMetricById(metricId);
    if (!existing) return null;

    const merged: Record<string, unknown> = { ...existing };
    if ('code' in body && typeof body.code === 'string') {
      merged.code = body.code.trim().slice(0, 64);
    }
    if ('name' in body && typeof body.name === 'string') {
      merged.name = body.name.trim().slice(0, 240);
    }
    if ('unit' in body && typeof body.unit === 'string') {
      merged.unit = body.unit.trim().slice(0, 64);
    }
    if ('description' in body && typeof body.description === 'string') {
      merged.description = body.description.trim().slice(0, 2000);
    }
    if ('sort_order' in body && body.sort_order != null) {
      const so = Number(body.sort_order);
      if (Number.isFinite(so)) merged.sort_order = so;
    }
    if ('active' in body) {
      merged.active = truthyFlag(body.active) ? 1 : 0;
    }
    if ('higher_is_better' in body) {
      merged.higher_is_better = truthyFlag(body.higher_is_better) ? 1 : 0;
    }
    if ('warn_ratio' in body) {
      const wrv = body.warn_ratio;
      if (wrv == null) {
        merged.warn_ratio = null;
      } else {
        const wr = Number(wrv);
        merged.warn_ratio = Number.isFinite(wr) ? wr : merged.warn_ratio;
      }
    }

    const code = String(merged.code ?? '').trim();
    if (code) {
      const dup = await this.db.query(
        `SELECT 1 FROM crm_kpi_metrics
         WHERE lower(trim(code)) = lower($1) AND trim(code) != '' AND id != $2`,
        [code, metricId],
      );
      if (dup.rows.length > 0) throw new Error('DUPLICATE_CODE');
    }

    await this.db.query(
      `UPDATE crm_kpi_metrics
       SET code = $2, name = $3, unit = $4, description = $5, sort_order = $6, active = $7,
           higher_is_better = $8, warn_ratio = $9, updated_at = NOW()
       WHERE id = $1`,
      [
        metricId,
        String(merged.code ?? ''),
        String(merged.name ?? ''),
        String(merged.unit ?? ''),
        String(merged.description ?? ''),
        Number(merged.sort_order ?? 0),
        Number(merged.active ?? 1) === 1,
        Number(merged.higher_is_better ?? 1) === 1,
        merged.warn_ratio != null ? Number(merged.warn_ratio) : null,
      ],
    );

    return this.getMetricById(metricId);
  }

  async listStaffKpi(
    year: number,
    month: number,
    staffId?: number,
  ): Promise<StaffKpiEntryRow[]> {
    const clauses = ['k.year = $1', 'k.month = $2'];
    const params: (string | number)[] = [year, month];
    if (staffId != null) {
      const staff = await this.resolveStaff(staffId);
      if (!staff) return [];
      clauses.push(`k.staff_id = $${params.length + 1}`);
      params.push(staff.pgId);
    }
    const whereSql = clauses.join(' AND ');
    const result = await this.db.query(
      `SELECT k.*,
              m.name AS metric_name, m.code AS metric_code, m.unit AS metric_unit,
              m.higher_is_better AS metric_higher_is_better,
              m.warn_ratio AS metric_warn_ratio,
              s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_staff_kpi k
       JOIN crm_kpi_metrics m ON m.id = k.metric_id
       JOIN crm_staff s ON s.id = k.staff_id
       WHERE ${whereSql}
       ORDER BY lower(s.name) ASC, m.sort_order ASC, lower(m.name) ASC`,
      params,
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => this.mapStaffKpiRow(row));
  }

  async staffExists(staffId: number): Promise<boolean> {
    return (await this.resolveStaff(staffId)) != null;
  }

  async computeStaffRoleMetrics(
    staffId: number,
    role: string,
    year: number,
    month: number,
  ): Promise<StaffKpiMetricsResponse> {
    const staff = await this.resolveStaff(staffId);
    const ids = staff
      ? this.staffIdVariants(staff.pgId, staff.sqliteId, staffId)
      : [staffId];
    const { start, end } = this.monthRange(year, month);
    const metrics: StaffKpiMetricItem[] = [];

    if (role === 'am') {
      const leadsResult = await this.db.query(
        `SELECT COUNT(*)::bigint AS n FROM crm_leads
         WHERE owner_id = ANY($1::bigint[])
           AND created_at >= $2::date AND created_at < $3::date`,
        [ids, start, end],
      );
      const lcResult = await this.db.query(
        `SELECT COUNT(*)::bigint AS n FROM crm_service_lifecycle
         WHERE assigned_am = ANY($1::bigint[])
           AND created_at >= $2::date AND created_at < $3::date`,
        [ids, start, end],
      );
      const casesCount = await this.countCases(ids, start, end);

      metrics.push(
        {
          key: 'leads_owned',
          label: 'Lead phụ trách',
          value: Number(leadsResult.rows[0]?.n ?? 0),
          target: null,
        },
        {
          key: 'lifecycles',
          label: 'Lifecycle AM',
          value: Number(lcResult.rows[0]?.n ?? 0),
          target: null,
        },
        { key: 'cases', label: 'Hồ sơ phụ trách', value: casesCount, target: null },
      );
    } else {
      const lcResult = await this.db.query(
        `SELECT COUNT(*)::bigint AS n FROM crm_service_lifecycle
         WHERE assigned_sp = ANY($1::bigint[])
           AND created_at >= $2::date AND created_at < $3::date`,
        [ids, start, end],
      );
      const tasksResult = await this.db.query(
        `SELECT COUNT(*)::bigint AS n FROM crm_svc_tasks
         WHERE done_by = ANY($1::bigint[]) AND is_done = TRUE
           AND updated_at >= $2::date AND updated_at < $3::date`,
        [ids, start, end],
      );
      const casesCount = await this.countCases(ids, start, end);

      metrics.push(
        {
          key: 'lifecycles',
          label: 'Lifecycle SP',
          value: Number(lcResult.rows[0]?.n ?? 0),
          target: null,
        },
        {
          key: 'tasks_done',
          label: 'Task hoàn thành',
          value: Number(tasksResult.rows[0]?.n ?? 0),
          target: null,
        },
        { key: 'cases', label: 'Hồ sơ liên quan', value: casesCount, target: null },
      );
    }

    return { staff_id: staffId, role, year, month, metrics };
  }

  private async countCases(ids: number[], start: string, end: string): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*)::bigint AS n FROM crm_cases
         WHERE assigned_staff_id = ANY($1::bigint[])
           AND created_at >= $2::date AND created_at < $3::date`,
        [ids, start, end],
      );
      return Number(result.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }

  async listKpiAlerts(year: number, month: number, staffId?: number) {
    const rows = await this.listStaffKpi(year, month, staffId);
    const alerts: Array<Record<string, unknown>> = [];
    let crit = 0;
    let wrn = 0;
    for (const row of rows) {
      const { level, reason } = deriveKpiAlert(
        row.status,
        row.metric_higher_is_better,
        row.metric_warn_ratio,
        row.target_value,
        row.actual_value,
      );
      if (!level) continue;
      if (level === 'critical') crit += 1;
      else if (level === 'warn') wrn += 1;
      alerts.push({
        level,
        reason,
        message: kpiAlertLabelVi(level, reason),
        kpi_id: row.id,
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        staff_code: row.staff_code,
        metric_id: row.metric_id,
        metric_name: row.metric_name,
        metric_code: row.metric_code,
        target_value: row.target_value,
        actual_value: row.actual_value,
        status: row.status,
      });
    }
    return { alerts, summary: { critical: crit, warn: wrn }, year, month };
  }

  async fetchKpiChart(metricId: number, year: number, month: number, staffId?: number) {
    const metric = await this.getMetricById(metricId);
    if (!metric) return null;
    const clauses = ['k.year = $1', 'k.month = $2', 'k.metric_id = $3'];
    const params: (string | number)[] = [year, month, metricId];
    if (staffId != null) {
      const staff = await this.resolveStaff(staffId);
      if (!staff) {
        return {
          metric: metric as unknown as Record<string, unknown>,
          higher_is_better: metric.higher_is_better,
          year,
          month,
          labels: [],
          achievement_pct: [],
          staff_ids: [],
        };
      }
      clauses.push(`k.staff_id = $${params.length + 1}`);
      params.push(staff.pgId);
    }
    const result = await this.db.query(
      `SELECT k.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_staff_kpi k
       JOIN crm_staff s ON s.id = k.staff_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY lower(s.name) ASC`,
      params,
    );
    const rows = result.rows as Array<Record<string, unknown>>;

    const labels: string[] = [];
    const achievementPct: Array<number | null> = [];
    const staffIds: number[] = [];
    const hi = metric.higher_is_better;
    for (const r of rows) {
      const sid = Number(r.staff_id);
      const sn = String(r.staff_name ?? '').trim();
      const sc = String(r.staff_code ?? '').trim();
      labels.push(sc ? `${sn} (${sc})` : sn);
      staffIds.push(sid);
      achievementPct.push(kpiAchievementPct(hi, r.target_value, r.actual_value));
    }

    return {
      metric: metric as unknown as Record<string, unknown>,
      higher_is_better: hi,
      year,
      month,
      labels,
      achievement_pct: achievementPct,
      staff_ids: staffIds,
    };
  }

  async fetchMetricTrend(metricId: number, year: number, month: number, monthCount: number) {
    const metric = await this.getMetricById(metricId);
    if (!metric) return null;
    const capped = Math.min(Math.max(monthCount, 2), 12);
    const labels: string[] = [];
    const avgAchievementPct: number[] = [];
    let y = year;
    let m = month;
    for (let i = 0; i < capped; i += 1) {
      const chart = await this.fetchKpiChart(metricId, y, m);
      const pcts = ((chart?.achievement_pct ?? []) as Array<number | null>).filter(
        (value): value is number => value != null && Number.isFinite(value),
      );
      const avg =
        pcts.length > 0
          ? Math.round((pcts.reduce((sum, value) => sum + value, 0) / pcts.length) * 10) / 10
          : 0;
      labels.unshift(`${String(m).padStart(2, '0')}/${y}`);
      avgAchievementPct.unshift(avg);
      if (m === 1) {
        y -= 1;
        m = 12;
      } else {
        m -= 1;
      }
    }
    return {
      metric_id: metricId,
      metric_name: metric.name,
      year,
      month,
      months: capped,
      labels,
      avg_achievement_pct: avgAchievementPct,
    };
  }

  async getStaffKpiById(kpiId: number): Promise<StaffKpiEntryRow | null> {
    const result = await this.db.query(
      `SELECT k.*,
              m.name AS metric_name, m.code AS metric_code, m.unit AS metric_unit,
              m.higher_is_better AS metric_higher_is_better,
              m.warn_ratio AS metric_warn_ratio,
              s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_staff_kpi k
       JOIN crm_kpi_metrics m ON m.id = k.metric_id
       JOIN crm_staff s ON s.id = k.staff_id
       WHERE k.id = $1`,
      [kpiId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapStaffKpiRow(row) : null;
  }

  async patchStaffKpiProgress(
    kpiId: number,
    body: PatchStaffKpiProgressBody,
  ): Promise<StaffKpiEntryRow | null> {
    const existingResult = await this.db.query(`SELECT * FROM crm_staff_kpi WHERE id = $1`, [
      kpiId,
    ]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, unknown> = { ...existing };
    if ('actual_value' in body) {
      const av = body.actual_value;
      merged.actual_value =
        av == null || av === ('' as unknown)
          ? null
          : Number.isFinite(Number(av))
            ? Number(av)
            : merged.actual_value;
    }
    if ('status' in body && body.status != null) {
      merged.status = String(body.status).trim().slice(0, 32);
    }
    if ('note' in body && typeof body.note === 'string') {
      merged.notes = body.note.trim().slice(0, 2000);
    }

    await this.db.query(
      `UPDATE crm_staff_kpi
       SET actual_value = $2, status = $3, notes = $4, updated_at = NOW()
       WHERE id = $1`,
      [
        kpiId,
        merged.actual_value != null ? Number(merged.actual_value) : null,
        String(merged.status ?? 'draft'),
        String(merged.notes ?? ''),
      ],
    );

    return this.getStaffKpiById(kpiId);
  }

  async exportStaffKpi(year: number, month: number, staffId?: number) {
    return {
      staff_kpi: await this.listStaffKpi(year, month, staffId),
      year,
      month,
    };
  }

  private mapMetricRow(row: Record<string, unknown>): KpiMetricRow {
    return {
      id: Number(row.id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      unit: String(row.unit ?? ''),
      description: String(row.description ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      active: row.active === true || row.active === 1 ? 1 : 0,
      higher_is_better: row.higher_is_better === true || row.higher_is_better === 1 ? 1 : 0,
      warn_ratio: row.warn_ratio != null ? Number(row.warn_ratio) : null,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapStaffKpiRow(row: Record<string, unknown>): StaffKpiEntryRow {
    return {
      id: Number(row.id),
      staff_id: Number(row.staff_id),
      metric_id: Number(row.metric_id),
      year: Number(row.year),
      month: Number(row.month),
      target_value: row.target_value != null ? Number(row.target_value) : null,
      actual_value: row.actual_value != null ? Number(row.actual_value) : null,
      status: String(row.status ?? ''),
      note: String(row.note ?? row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
      metric_name: String(row.metric_name ?? ''),
      metric_code: String(row.metric_code ?? ''),
      metric_unit: String(row.metric_unit ?? ''),
      metric_higher_is_better:
        row.metric_higher_is_better === true || row.metric_higher_is_better === 1 ? 1 : 0,
      metric_warn_ratio: row.metric_warn_ratio != null ? Number(row.metric_warn_ratio) : null,
      staff_name: String(row.staff_name ?? ''),
      staff_code: String(row.staff_code ?? ''),
    };
  }

  async staffIdsForTeam(team: Exclude<KpiTeamCode, 'all'>): Promise<number[]> {
    const patterns = KPI_TEAM_DEPT_PATTERNS[team];
    const clauses = patterns
      .map(
        (_, i) =>
          `(lower(coalesce(s.department, '')) LIKE $${i + 1} OR lower(coalesce(s.job_title, '')) LIKE $${i + 1})`,
      )
      .join(' OR ');
    const result = await this.db.query(
      `SELECT DISTINCT s.id
       FROM crm_staff s
       WHERE s.active = true AND (${clauses})`,
      patterns,
    );
    return (result.rows as Array<{ id: number }>).map((r) => Number(r.id));
  }
}
