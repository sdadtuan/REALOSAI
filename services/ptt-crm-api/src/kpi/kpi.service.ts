import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { KpiPgRepository } from './kpi-pg.repository';
import { KpiSqliteRepository } from './kpi-sqlite.repository';
import { buildStaffKpiXlsx } from './kpi-export.util';
import { normalizeKpiTeam, type KpiTeamCode } from './kpi-team-filter.util';
import {
  CreateKpiMetricBody,
  PatchKpiMetricBody,
  PatchStaffKpiProgressBody,
} from './kpi.types';

@Injectable()
export class KpiService {
  constructor(
    private readonly sqlite: KpiSqliteRepository,
    private readonly pg: KpiPgRepository,
    private readonly config: AppConfigService,
    @Inject(forwardRef(() => LeadsFunnelService))
    private readonly funnel: LeadsFunnelService,
  ) {}

  async listMetrics(includeInactive: boolean) {
    if (this.config.crmKpiPg) {
      return { metrics: await this.pg.listMetrics(includeInactive) };
    }
    return { metrics: this.sqlite.listMetrics(includeInactive) };
  }

  async createMetric(body: CreateKpiMetricBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên chỉ tiêu' });
    }
    try {
      if (this.config.crmKpiPg) {
        return await this.pg.createMetric({ ...body, name });
      }
      return this.sqlite.createMetric({ ...body, name });
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_CODE') {
        throw new ConflictException({ error: 'Mã chỉ tiêu đã tồn tại' });
      }
      throw err;
    }
  }

  async patchMetric(metricId: number, body: PatchKpiMetricBody) {
    if ('name' in body && body.name != null) {
      const nm = String(body.name).trim();
      if (!nm) {
        throw new BadRequestException({ error: 'Tên không được trống' });
      }
    }
    try {
      const updated = this.config.crmKpiPg
        ? await this.pg.patchMetric(metricId, body)
        : this.sqlite.patchMetric(metricId, body);
      if (!updated) {
        throw new NotFoundException({ error: 'Không tìm thấy chỉ tiêu' });
      }
      return updated;
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_CODE') {
        throw new ConflictException({ error: 'Mã chỉ tiêu đã tồn tại' });
      }
      throw err;
    }
  }

  async listStaffKpi(year?: string, month?: string, staffId?: string) {
    const parsed = this.parseYearMonth(year, month);
    let sid: number | undefined;
    if (staffId) {
      const n = Number(staffId);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      sid = n;
    }
    const staffKpi = this.config.crmKpiPg
      ? await this.pg.listStaffKpi(parsed.year, parsed.month, sid)
      : this.sqlite.listStaffKpi(parsed.year, parsed.month, sid);
    return { staff_kpi: staffKpi };
  }

  async listAlerts(year?: string, month?: string, staffId?: string, team?: string) {
    const parsed = this.parseYearMonth(year, month);
    let sid: number | undefined;
    if (staffId) {
      const n = Number(staffId);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      sid = n;
    }
    const raw = this.config.crmKpiPg
      ? await this.pg.listKpiAlerts(parsed.year, parsed.month, sid)
      : this.sqlite.listKpiAlerts(parsed.year, parsed.month, sid);
    return this.filterAlertsByTeam(raw, team);
  }

  async boardSummary(year?: string, month?: string, team?: string) {
    const parsed = this.parseYearMonth(year, month, true);
    const alerts = await this.listAlerts(
      String(parsed.year),
      String(parsed.month),
      undefined,
      team,
    );
    let staffKpi = this.config.crmKpiPg
      ? await this.pg.listStaffKpi(parsed.year, parsed.month)
      : this.sqlite.listStaffKpi(parsed.year, parsed.month);
    const teamIds = await this.resolveTeamStaffIds(normalizeKpiTeam(team));
    if (teamIds) {
      staffKpi = staffKpi.filter((row) => teamIds.has(row.staff_id));
    }
    const staffIds = new Set(staffKpi.map((row) => row.staff_id));
    return {
      year: parsed.year,
      month: parsed.month,
      team: normalizeKpiTeam(team),
      summary: alerts.summary,
      staff_count: staffIds.size,
      kpi_count: staffKpi.length,
      alerts: alerts.alerts,
    };
  }

  async chart(
    metricIdRaw?: string,
    year?: string,
    month?: string,
    staffId?: string,
    team?: string,
  ) {
    const metricId = Number(metricIdRaw ?? 0);
    if (!Number.isFinite(metricId) || metricId <= 0) {
      throw new BadRequestException({ error: 'Cần metric_id (chỉ tiêu để vẽ biểu đồ)' });
    }
    const parsed = this.parseYearMonth(year, month);
    let sid: number | undefined;
    if (staffId) {
      const n = Number(staffId);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      sid = n;
    }
    const chart = this.config.crmKpiPg
      ? await this.pg.fetchKpiChart(metricId, parsed.year, parsed.month, sid)
      : this.sqlite.fetchKpiChart(metricId, parsed.year, parsed.month, sid);
    if (!chart) {
      throw new NotFoundException({ error: 'Không tìm thấy chỉ tiêu' });
    }
    return await this.filterChartByTeam(chart, team);
  }

  async metricTrend(metricIdRaw?: string, year?: string, month?: string, monthsRaw?: string) {
    const metricId = Number(metricIdRaw ?? 0);
    if (!Number.isFinite(metricId) || metricId <= 0) {
      throw new BadRequestException({ error: 'Cần metric_id' });
    }
    const parsed = this.parseYearMonth(year, month, true);
    const months = Math.min(Math.max(Number(monthsRaw ?? 6) || 6, 2), 12);
    const trend = this.config.crmKpiPg
      ? await this.pg.fetchMetricTrend(metricId, parsed.year, parsed.month, months)
      : this.sqlite.fetchMetricTrend(metricId, parsed.year, parsed.month, months);
    if (!trend) {
      throw new NotFoundException({ error: 'Không tìm thấy chỉ tiêu' });
    }
    return trend;
  }

  async exportStaffKpiXlsx(year?: string, month?: string, staffId?: string) {
    const parsed = this.parseYearMonth(year, month, true);
    let sid: number | undefined;
    if (staffId) {
      const n = Number(staffId);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      sid = n;
    }
    const rows = this.config.crmKpiPg
      ? await this.pg.listStaffKpi(parsed.year, parsed.month, sid)
      : this.sqlite.listStaffKpi(parsed.year, parsed.month, sid);
    return buildStaffKpiXlsx(rows, parsed.year, parsed.month);
  }

  async exportStaffKpi(year?: string, month?: string, staffId?: string) {
    const parsed = this.parseYearMonth(year, month);
    let sid: number | undefined;
    if (staffId) {
      const n = Number(staffId);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      sid = n;
    }
    if (this.config.crmKpiPg) {
      return this.pg.exportStaffKpi(parsed.year, parsed.month, sid);
    }
    return this.sqlite.exportStaffKpi(parsed.year, parsed.month, sid);
  }

  async patchStaffKpiProgress(kpiId: number, body: PatchStaffKpiProgressBody) {
    if ('actual_value' in body && body.actual_value != null) {
      const av = Number(body.actual_value);
      if (!Number.isFinite(av) || av < 0) {
        throw new BadRequestException({ error: 'actual_value phải ≥ 0' });
      }
    }
    const updated = this.config.crmKpiPg
      ? await this.pg.patchStaffKpiProgress(kpiId, body)
      : this.sqlite.patchStaffKpiProgress(kpiId, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy KPI' });
    }
    return updated;
  }

  async staffRoleMetrics(staffId: number, role?: string, year?: string, month?: string) {
    const exists = this.config.crmKpiPg
      ? await this.pg.staffExists(staffId)
      : this.sqlite.staffExists(staffId);
    if (!exists) {
      throw new NotFoundException({ error: 'Không tìm thấy staff' });
    }
    const roleNorm = String(role ?? 'am').trim().toLowerCase();
    if (roleNorm !== 'am' && roleNorm !== 'sp') {
      throw new BadRequestException({ error: 'role phải là am hoặc sp' });
    }
    const parsed = this.parseYearMonth(year, month, true);
    const base = this.config.crmKpiPg
      ? await this.pg.computeStaffRoleMetrics(staffId, roleNorm, parsed.year, parsed.month)
      : this.sqlite.computeStaffRoleMetrics(staffId, roleNorm, parsed.year, parsed.month);

    if (roleNorm !== 'am') {
      return base;
    }

    const monthStr = String(parsed.month).padStart(2, '0');
    const lastDay = new Date(parsed.year, parsed.month, 0).getDate();
    const periodStart = `${parsed.year}-${monthStr}-01`;
    const periodEnd = `${parsed.year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    try {
      const funnelOut = await this.funnel.getPresalesFunnelMetrics({
        periodStart,
        periodEnd,
        amId: staffId,
      });
      const m = funnelOut.metrics;
      base.metrics.push(
        {
          key: 'go_to_consult_median_hours',
          label: 'Go → Consult median (h)',
          value: m.go_to_consult_median_hours ?? 0,
          target: 48,
        },
        {
          key: 'consult_to_proposal_7d_pct',
          label: 'Consult → BG ≤7d (%)',
          value: m.consult_to_proposal_7d_pct,
          target: 50,
        },
        {
          key: 'consult_form_completion_pct',
          label: 'Form Consult hoàn thành (%)',
          value: m.consult_form_completion_pct,
          target: 80,
        },
        {
          key: 'consult_task_done_rate',
          label: 'Task Consult ✓ (%)',
          value: m.consult_task_done_rate,
          target: 70,
        },
      );
    } catch {
      // presales funnel may be disabled in some envs
    }

    return base;
  }

  async solutionDashboard(team?: string, year?: string, month?: string, period?: string) {
    let parsed = this.parseYearMonth(year, month, true);
    const periodRaw = String(period ?? '').trim();
    if (/^\d{4}-\d{2}$/.test(periodRaw)) {
      const [y, m] = periodRaw.split('-').map(Number);
      parsed = { year: y!, month: m! };
    }

    const monthStr = String(parsed.month).padStart(2, '0');
    const lastDay = new Date(parsed.year, parsed.month, 0).getDate();
    const periodStart = `${parsed.year}-${monthStr}-01`;
    const periodEnd = `${parsed.year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const [funnelOut, slaOut, queueOut] = await Promise.all([
      this.funnel.getPresalesFunnelMetrics({ periodStart, periodEnd }),
      this.funnel.getPresalesConsultSlaSummary(null),
      this.funnel.listSolutionQueue(undefined, 500),
    ]);

    let pending = 0;
    let withSolution = 0;
    for (const row of queueOut.rows ?? []) {
      if (row.handoff_status === 'pending') pending += 1;
      else if (row.handoff_status === 'with_solution') withSolution += 1;
    }

    return {
      team: normalizeKpiTeam(team),
      year: parsed.year,
      month: parsed.month,
      period_start: periodStart,
      period_end: periodEnd,
      funnel: funnelOut,
      sla: slaOut.summary,
      queue: {
        pending,
        with_solution: withSolution,
        total: queueOut.count ?? queueOut.rows?.length ?? 0,
      },
    };
  }

  private async resolveTeamStaffIds(team: KpiTeamCode): Promise<Set<number> | null> {
    if (team === 'all') return null;
    const ids = this.config.crmKpiPg
      ? await this.pg.staffIdsForTeam(team)
      : this.sqlite.staffIdsForTeam(team);
    return new Set(ids);
  }

  private async filterAlertsByTeam(
    raw: { alerts: Array<Record<string, unknown>>; summary: { critical: number; warn: number }; year: number; month: number },
    team?: string,
  ) {
    const teamIds = await this.resolveTeamStaffIds(normalizeKpiTeam(team));
    if (!teamIds) {
      return { ...raw, team: normalizeKpiTeam(team) };
    }
    const alerts = raw.alerts.filter((a) => teamIds.has(Number(a.staff_id)));
    let critical = 0;
    let warn = 0;
    for (const a of alerts) {
      if (a.level === 'critical') critical += 1;
      else if (a.level === 'warn') warn += 1;
    }
    return {
      alerts,
      summary: { critical, warn },
      year: raw.year,
      month: raw.month,
      team: normalizeKpiTeam(team),
    };
  }

  private async filterChartByTeam(
    chart: {
      metric: Record<string, unknown>;
      higher_is_better: boolean | number;
      year: number;
      month: number;
      labels: string[];
      achievement_pct: Array<number | null>;
      staff_ids: number[];
    },
    team?: string,
  ) {
    const teamIds = await this.resolveTeamStaffIds(normalizeKpiTeam(team));
    if (!teamIds) {
      return chart;
    }
    const keep: number[] = [];
    for (let i = 0; i < chart.staff_ids.length; i += 1) {
      if (teamIds.has(chart.staff_ids[i]!)) keep.push(i);
    }
    return {
      ...chart,
      labels: keep.map((i) => chart.labels[i]!),
      achievement_pct: keep.map((i) => chart.achievement_pct[i] ?? null),
      staff_ids: keep.map((i) => chart.staff_ids[i]!),
    };
  }

  private parseYearMonth(
    yearRaw?: string,
    monthRaw?: string,
    defaultNow = false,
  ): { year: number; month: number } {
    const now = new Date();
    let year = Number(yearRaw ?? (defaultNow ? now.getFullYear() : 0));
    let month = Number(monthRaw ?? (defaultNow ? now.getMonth() + 1 : 0));
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      throw new BadRequestException({ error: 'year/month không hợp lệ' });
    }
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      throw new BadRequestException({ error: 'Kỳ không hợp lệ' });
    }
    return { year, month };
  }
}
