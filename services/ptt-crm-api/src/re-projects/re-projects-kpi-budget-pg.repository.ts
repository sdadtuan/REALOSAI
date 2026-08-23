import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  enrichBudgetRow,
  enrichKpiRow,
  enrichRiskRow,
  pgRowToPlain,
  type StaffKpiLookup,
  type StaffLookup,
} from './re-projects-kpi-pg.mapper';
import {
  currentPeriodMonth,
  KPI_CATEGORIES,
  KPI_METRIC_TEMPLATES,
  KPI_TRACK_STATUSES,
  mapReTrackToStaffStatus,
  mapStaffToReTrackStatus,
  parsePeriodMonth,
  RE_LEADS_NEW_EXCLUDED_STATUSES,
  RE_LEADS_NEW_METRIC_CODE,
} from './re-projects-kpi.util';
import {
  BUDGET_CATEGORIES,
  RISK_CATEGORIES,
  RISK_LEVELS,
} from './re-projects.types';

@Injectable()
export class ReProjectsKpiBudgetPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private async staffLookup(ids: Set<number>): Promise<StaffLookup> {
    const arr = [...ids].filter((id) => id > 0);
    if (!arr.length) return {};
    const res = await this.db.query(
      `SELECT id, name, job_title, department FROM crm_staff WHERE id = ANY($1::bigint[])`,
      [arr],
    );
    const map: StaffLookup = {};
    for (const r of res.rows) {
      map[Number(r.id)] = {
        name: String(r.name ?? ''),
        job_title: String(r.job_title ?? ''),
        department: String(r.department ?? ''),
      };
    }
    return map;
  }

  private async staffKpiLookup(ids: Set<number>): Promise<StaffKpiLookup> {
    const arr = [...ids].filter((id) => id > 0);
    if (!arr.length) return {};
    const res = await this.db.query(
      `SELECT id, actual_value, status FROM crm_staff_kpi WHERE id = ANY($1::bigint[])`,
      [arr],
    );
    const map: StaffKpiLookup = {};
    for (const r of res.rows) {
      map[Number(r.id)] = {
        actual_value: r.actual_value != null ? Number(r.actual_value) : null,
        status: String(r.status ?? ''),
      };
    }
    return map;
  }

  async listCrmKpiMetrics(reOnly = false): Promise<Array<Record<string, unknown>>> {
    const sql = reOnly
      ? `SELECT * FROM crm_kpi_metrics WHERE active = TRUE AND code LIKE 'RE_%'
         ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM crm_kpi_metrics WHERE active = TRUE ORDER BY sort_order ASC, name ASC`;
    const res = await this.db.query(sql);
    return res.rows.map((r) => pgRowToPlain(r as Record<string, unknown>));
  }

  async listKpis(projectId: number): Promise<Array<Record<string, unknown>>> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_kpis WHERE project_id = $1
       ORDER BY period_month DESC, owner_staff_id, id`,
      [projectId],
    );
    const staffIds = new Set<number>();
    const staffKpiIds = new Set<number>();
    for (const r of res.rows) {
      if (r.owner_staff_id) staffIds.add(Number(r.owner_staff_id));
      if (r.staff_kpi_id) staffKpiIds.add(Number(r.staff_kpi_id));
    }
    const [staffMap, staffKpiMap] = await Promise.all([
      this.staffLookup(staffIds),
      this.staffKpiLookup(staffKpiIds),
    ]);
    return res.rows.map((r) => {
      const d = pgRowToPlain(r as Record<string, unknown>);
      enrichKpiRow(d, staffMap, staffKpiMap);
      return d;
    });
  }

  private async resolveOwnerStaff(payload: Record<string, unknown>): Promise<{
    staffId: number | null;
    ownerName: string;
  }> {
    let staffId: number | null = null;
    const rawId = payload.owner_staff_id;
    if (rawId != null && String(rawId).trim() !== '') {
      const parsed = Number(rawId);
      staffId = Number.isFinite(parsed) ? parsed : null;
    }
    let ownerName = String(payload.owner_name ?? '').trim();
    if (staffId && staffId > 0) {
      const res = await this.db.query(`SELECT name FROM crm_staff WHERE id = $1`, [staffId]);
      if (res.rows[0]) ownerName = String(res.rows[0].name || ownerName);
    }
    return { staffId: staffId && staffId > 0 ? staffId : null, ownerName: ownerName.slice(0, 120) };
  }

  private async resolveCrmMetric(
    payload: Record<string, unknown>,
    metricName: string,
    unit: string,
  ): Promise<{ metricId: number | null; metricCode: string; name: string; unit: string }> {
    let metricId: number | null = null;
    const rawMid = payload.metric_id;
    if (rawMid != null && String(rawMid).trim() !== '') {
      const parsed = Number(rawMid);
      metricId = Number.isFinite(parsed) ? parsed : null;
    }
    const metricCode = String(payload.metric_code ?? '').trim();
    try {
      if (metricId && metricId > 0) {
        const res = await this.db.query(
          `SELECT id, code, name, unit FROM crm_kpi_metrics WHERE id = $1 AND active = TRUE`,
          [metricId],
        );
        const row = res.rows[0];
        if (row) {
          return {
            metricId: Number(row.id),
            metricCode: String(row.code),
            name: String(row.name),
            unit: String(row.unit || unit),
          };
        }
      }
      const codesToTry: string[] = [];
      if (metricCode) {
        codesToTry.push(metricCode, metricCode.toUpperCase(), `RE_${metricCode.toUpperCase()}`);
      }
      for (const tpl of KPI_METRIC_TEMPLATES) {
        if (metricCode && tpl.code === metricCode) codesToTry.push(tpl.crm_code);
        if (metricName && tpl.metric_name === metricName) codesToTry.push(tpl.crm_code);
      }
      for (const codeTry of codesToTry) {
        if (!codeTry) continue;
        const res = await this.db.query(
          `SELECT id, code, name, unit FROM crm_kpi_metrics
           WHERE lower(trim(code)) = lower($1) AND active = TRUE`,
          [codeTry],
        );
        const row = res.rows[0];
        if (row) {
          return {
            metricId: Number(row.id),
            metricCode: String(row.code),
            name: String(row.name),
            unit: String(row.unit || unit),
          };
        }
      }
    } catch {
      /* ignore lookup errors */
    }
    return { metricId: null, metricCode: metricCode.slice(0, 40), name: metricName, unit };
  }

  private async syncKpiToStaffModule(kpiId: number, projectId: number, ts?: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_kpis WHERE id = $1 AND project_id = $2`,
      [kpiId, projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return false;
    let staffId = Number(row.owner_staff_id ?? 0);
    let metricId = Number(row.metric_id ?? 0);
    if (!metricId) {
      const resolved = await this.resolveCrmMetric(
        row,
        String(row.metric_name ?? ''),
        String(row.unit ?? ''),
      );
      metricId = Number(resolved.metricId ?? 0);
      if (metricId) {
        await this.db.query(
          `UPDATE crm_re_project_kpis SET metric_id = $1, metric_code = $2 WHERE id = $3`,
          [metricId, resolved.metricCode, kpiId],
        );
      }
    }
    if (staffId <= 0 || metricId <= 0) return false;
    const { year, month } = parsePeriodMonth(String(row.period_month ?? ''));
    if (year == null || month == null) return false;
    const projRes = await this.db.query(`SELECT name FROM crm_re_projects WHERE id = $1`, [projectId]);
    const projName = String(projRes.rows[0]?.name ?? '');
    const note = String(row.notes ?? '').trim();
    const syncNote = `[Dự án BĐS: ${projName} (#${projectId})] ${note}`.trim().slice(0, 2000);
    const staffStatus = mapReTrackToStaffStatus(String(row.track_status ?? 'active'));
    const tsVal = ts ?? catalogTs();
    try {
      const upsert = await this.db.query(
        `INSERT INTO crm_staff_kpi (
           staff_id, metric_id, year, month,
           target_value, actual_value, status, notes, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::timestamptz)
         ON CONFLICT (staff_id, metric_id, year, month) DO UPDATE SET
           target_value = EXCLUDED.target_value,
           actual_value = EXCLUDED.actual_value,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          staffId,
          metricId,
          year,
          month,
          Number(row.target_value ?? 0),
          Number(row.actual_value ?? 0),
          staffStatus,
          syncNote,
          tsVal,
        ],
      );
      const skId = Number(upsert.rows[0]?.id ?? 0);
      if (skId) {
        await this.db.query(
          `UPDATE crm_re_project_kpis SET staff_kpi_id = $1, metric_id = $2, updated_at = NOW() WHERE id = $3`,
          [skId, metricId, kpiId],
        );
      }
    } catch {
      return false;
    }
    return true;
  }

  async saveKpi(
    projectId: number,
    payload: Record<string, unknown>,
    kpiId?: number,
    ts?: string,
  ): Promise<Record<string, unknown>> {
    const tsVal = ts ?? catalogTs();
    let cat = String(payload.category ?? 'sales');
    if (!(KPI_CATEGORIES as readonly string[]).includes(cat)) cat = 'sales';
    const nameRaw = String(payload.metric_name ?? '').trim();
    if (!nameRaw) throw new Error('Thiếu tên chỉ tiêu KPI.');
    const { staffId: ownerStaffId, ownerName } = await this.resolveOwnerStaff(payload);
    let tr = String(payload.track_status ?? 'active');
    if (!(KPI_TRACK_STATUSES as readonly string[]).includes(tr)) tr = 'active';
    const unitInput = String(payload.unit ?? '').slice(0, 40);
    const { metricId, metricCode, name, unit } = await this.resolveCrmMetric(
      payload,
      nameRaw,
      unitInput,
    );

    let rid: number;
    if (kpiId) {
      await this.db.query(
        `UPDATE crm_re_project_kpis SET
           category = $3, metric_name = $4, target_value = $5, actual_value = $6, unit = $7,
           period_month = $8, weight_pct = $9, owner_staff_id = $10, owner_name = $11,
           track_status = $12, metric_code = $13, metric_id = $14, notes = $15, updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [
          kpiId,
          projectId,
          cat,
          name.slice(0, 200),
          Number(payload.target_value ?? 0),
          Number(payload.actual_value ?? 0),
          unit.slice(0, 40),
          String(payload.period_month ?? '').slice(0, 7),
          Number(payload.weight_pct ?? 0),
          ownerStaffId,
          ownerName,
          tr,
          metricCode,
          metricId,
          String(payload.notes ?? '').slice(0, 2000),
        ],
      );
      rid = kpiId;
    } else {
      const ins = await this.db.query(
        `INSERT INTO crm_re_project_kpis (
           project_id, category, metric_name, target_value, actual_value, unit,
           period_month, weight_pct, owner_staff_id, owner_name, track_status,
           metric_code, metric_id, notes, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
         RETURNING id`,
        [
          projectId,
          cat,
          name.slice(0, 200),
          Number(payload.target_value ?? 0),
          Number(payload.actual_value ?? 0),
          unit.slice(0, 40),
          String(payload.period_month ?? '').slice(0, 7),
          Number(payload.weight_pct ?? 0),
          ownerStaffId,
          ownerName,
          tr,
          metricCode,
          metricId,
          String(payload.notes ?? '').slice(0, 2000),
        ],
      );
      rid = Number(ins.rows[0].id);
    }
    if (ownerStaffId && (metricId || metricCode)) {
      await this.syncKpiToStaffModule(rid, projectId, tsVal);
    }
    const enriched = await this.listKpis(projectId);
    const found = enriched.find((d) => Number(d.id) === rid);
    if (found) return found;
    throw new Error('Không lưu được KPI.');
  }

  async deleteKpi(projectId: number, kpiId: number): Promise<void> {
    await this.db.query(`DELETE FROM crm_re_project_kpis WHERE id = $1 AND project_id = $2`, [
      kpiId,
      projectId,
    ]);
  }

  async syncProjectKpisToStaff(projectId: number, ts?: string): Promise<Record<string, unknown>> {
    const res = await this.db.query(
      `SELECT id FROM crm_re_project_kpis WHERE project_id = $1 ORDER BY id`,
      [projectId],
    );
    let synced = 0;
    let skipped = 0;
    for (const r of res.rows) {
      if (await this.syncKpiToStaffModule(Number(r.id), projectId, ts)) synced += 1;
      else skipped += 1;
    }
    return { synced, skipped, total: res.rows.length };
  }

  async pullProjectKpisFromStaff(projectId: number, ts?: string): Promise<Record<string, unknown>> {
    const tsVal = ts ?? catalogTs();
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_kpis WHERE project_id = $1 AND staff_kpi_id IS NOT NULL`,
      [projectId],
    );
    let updated = 0;
    for (const r of res.rows) {
      try {
        const skRes = await this.db.query(
          `SELECT actual_value, status FROM crm_staff_kpi WHERE id = $1`,
          [Number(r.staff_kpi_id)],
        );
        const sk = skRes.rows[0];
        if (!sk) continue;
        const track = mapStaffToReTrackStatus(String(sk.status ?? 'draft'));
        await this.db.query(
          `UPDATE crm_re_project_kpis
           SET actual_value = $1, track_status = $2, updated_at = $3::timestamptz
           WHERE id = $4 AND project_id = $5`,
          [Number(sk.actual_value ?? 0), track, tsVal, Number(r.id), projectId],
        );
        updated += 1;
      } catch {
        /* skip row */
      }
    }
    return { updated, total_linked: res.rows.length };
  }

  private async countProjectLeadsNewActual(projectId: number, periodMonth: string): Promise<number> {
    const pm = String(periodMonth || '').trim().slice(0, 7) || currentPeriodMonth();
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_leads
       WHERE re_project_id = $1
         AND COALESCE(is_duplicate, FALSE) = FALSE
         AND status <> ALL($2::text[])
         AND to_char(COALESCE(created_at, received_at, NOW()), 'YYYY-MM') = $3`,
      [projectId, [...RE_LEADS_NEW_EXCLUDED_STATUSES], pm],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async refreshProjectReLeadsNewKpi(
    projectId: number,
    options: { periodMonth?: string; ts?: string; syncStaff?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const tsVal = options.ts ?? catalogTs();
    const pm = String(options.periodMonth ?? '').trim().slice(0, 7) || currentPeriodMonth();
    const actual = await this.countProjectLeadsNewActual(projectId, pm);
    const existing = await this.db.query(
      `SELECT id FROM crm_re_project_kpis
       WHERE project_id = $1 AND metric_code = $2 AND period_month = $3
       ORDER BY id DESC LIMIT 1`,
      [projectId, RE_LEADS_NEW_METRIC_CODE, pm],
    );
    let kpiId: number | null = existing.rows[0] ? Number(existing.rows[0].id) : null;
    if (kpiId) {
      await this.db.query(
        `UPDATE crm_re_project_kpis SET actual_value = $1, updated_at = NOW() WHERE id = $2`,
        [actual, kpiId],
      );
    } else {
      const tmpl = KPI_METRIC_TEMPLATES.find((t) => t.crm_code === RE_LEADS_NEW_METRIC_CODE);
      if (tmpl) {
        const ins = await this.db.query(
          `INSERT INTO crm_re_project_kpis (
             project_id, category, metric_name, target_value, actual_value, unit,
             period_month, weight_pct, owner_name, track_status, metric_code,
             notes, created_at, updated_at
           ) VALUES ($1,$2,$3,0,$4,$5,$6,$7,'','active',$8,'',NOW(),NOW())
           RETURNING id`,
          [
            projectId,
            tmpl.category,
            tmpl.metric_name,
            actual,
            tmpl.unit,
            pm,
            tmpl.weight_pct,
            RE_LEADS_NEW_METRIC_CODE,
          ],
        );
        kpiId = Number(ins.rows[0].id);
      }
    }
    if (options.syncStaff !== false && kpiId) {
      await this.syncKpiToStaffModule(kpiId, projectId, tsVal);
    }
    return {
      updated: kpiId != null,
      kpi_id: kpiId,
      actual,
      period_month: pm,
      project_id: projectId,
    };
  }

  async listRisks(projectId: number): Promise<Array<Record<string, unknown>>> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_risks WHERE project_id = $1 ORDER BY risk_level DESC, id`,
      [projectId],
    );
    return res.rows.map((r) => {
      const d = pgRowToPlain(r as Record<string, unknown>);
      enrichRiskRow(d);
      return d;
    });
  }

  async saveRisk(
    projectId: number,
    payload: Record<string, unknown>,
    riskId?: number,
    ts?: string,
  ): Promise<Record<string, unknown>> {
    void ts;
    const title = String(payload.title ?? '').trim();
    if (!title) throw new Error('Thiếu tiêu đề rủi ro.');
    let cat = String(payload.category ?? 'market');
    if (!(RISK_CATEGORIES as readonly string[]).includes(cat)) cat = 'market';
    let lv = String(payload.risk_level ?? 'medium');
    if (!(RISK_LEVELS as readonly string[]).includes(lv)) lv = 'medium';

    let rid: number;
    if (riskId) {
      await this.db.query(
        `UPDATE crm_re_project_risks SET
           category = $3, title = $4, description = $5, probability_pct = $6, impact_pct = $7,
           risk_level = $8, mitigation = $9, owner_name = $10, status = $11, due_date = $12,
           updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [
          riskId,
          projectId,
          cat,
          title.slice(0, 200),
          String(payload.description ?? '').slice(0, 4000),
          Number(payload.probability_pct ?? 0),
          Number(payload.impact_pct ?? 0),
          lv,
          String(payload.mitigation ?? '').slice(0, 4000),
          String(payload.owner_name ?? '').slice(0, 120),
          String(payload.status ?? 'open').slice(0, 40),
          String(payload.due_date ?? '').slice(0, 10),
        ],
      );
      rid = riskId;
    } else {
      const ins = await this.db.query(
        `INSERT INTO crm_re_project_risks (
           project_id, category, title, description, probability_pct, impact_pct,
           risk_level, mitigation, owner_name, status, due_date, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
         RETURNING id`,
        [
          projectId,
          cat,
          title.slice(0, 200),
          String(payload.description ?? '').slice(0, 4000),
          Number(payload.probability_pct ?? 0),
          Number(payload.impact_pct ?? 0),
          lv,
          String(payload.mitigation ?? '').slice(0, 4000),
          String(payload.owner_name ?? '').slice(0, 120),
          String(payload.status ?? 'open').slice(0, 40),
          String(payload.due_date ?? '').slice(0, 10),
        ],
      );
      rid = Number(ins.rows[0].id);
    }
    const rowRes = await this.db.query(`SELECT * FROM crm_re_project_risks WHERE id = $1`, [rid]);
    const row = rowRes.rows[0];
    if (!row) throw new Error('Không lưu được rủi ro.');
    const d = pgRowToPlain(row as Record<string, unknown>);
    enrichRiskRow(d);
    return d;
  }

  async deleteRisk(projectId: number, riskId: number): Promise<void> {
    await this.db.query(`DELETE FROM crm_re_project_risks WHERE id = $1 AND project_id = $2`, [
      riskId,
      projectId,
    ]);
  }

  async listBudgetLines(projectId: number): Promise<Array<Record<string, unknown>>> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_budget_lines
       WHERE project_id = $1 ORDER BY period_month, category, id`,
      [projectId],
    );
    return res.rows.map((r) => {
      const d = pgRowToPlain(r as Record<string, unknown>);
      enrichBudgetRow(d);
      return d;
    });
  }

  async saveBudgetLine(
    projectId: number,
    payload: Record<string, unknown>,
    lineId?: number,
    ts?: string,
  ): Promise<Record<string, unknown>> {
    void ts;
    const item = String(payload.line_item ?? '').trim();
    if (!item) throw new Error('Thiếu hạng mục ngân sách.');
    let cat = String(payload.category ?? 'revenue');
    if (!(BUDGET_CATEGORIES as readonly string[]).includes(cat)) cat = 'revenue';

    let rid: number;
    if (lineId) {
      await this.db.query(
        `UPDATE crm_re_project_budget_lines SET
           category = $3, line_item = $4, period_month = $5, planned_vnd = $6,
           actual_vnd = $7, notes = $8, updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [
          lineId,
          projectId,
          cat,
          item.slice(0, 200),
          String(payload.period_month ?? '').slice(0, 7),
          Number(payload.planned_vnd ?? 0),
          Number(payload.actual_vnd ?? 0),
          String(payload.notes ?? '').slice(0, 2000),
        ],
      );
      rid = lineId;
    } else {
      const ins = await this.db.query(
        `INSERT INTO crm_re_project_budget_lines (
           project_id, category, line_item, period_month, planned_vnd, actual_vnd, notes,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
         RETURNING id`,
        [
          projectId,
          cat,
          item.slice(0, 200),
          String(payload.period_month ?? '').slice(0, 7),
          Number(payload.planned_vnd ?? 0),
          Number(payload.actual_vnd ?? 0),
          String(payload.notes ?? '').slice(0, 2000),
        ],
      );
      rid = Number(ins.rows[0].id);
    }
    const rowRes = await this.db.query(`SELECT * FROM crm_re_project_budget_lines WHERE id = $1`, [rid]);
    const row = rowRes.rows[0];
    if (!row) throw new Error('Không lưu được dòng ngân sách.');
    const d = pgRowToPlain(row as Record<string, unknown>);
    enrichBudgetRow(d);
    return d;
  }

  async deleteBudgetLine(projectId: number, lineId: number): Promise<void> {
    await this.db.query(`DELETE FROM crm_re_project_budget_lines WHERE id = $1 AND project_id = $2`, [
      lineId,
      projectId,
    ]);
  }
}
