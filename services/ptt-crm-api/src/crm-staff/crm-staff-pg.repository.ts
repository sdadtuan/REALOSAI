import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { LeadIngestRulesRepository } from '../leads/ingest/lead-ingest-rules.repository';
import { TERMINAL_STAGES, normalizePipelineStage } from '../sales/sales-pipeline.util';
import {
  COMPETENCY_METRIC_OPTIONS,
  DEFAULT_COMPETENCY_CONFIG,
  DEFAULT_STAFF_LEVELS,
} from './crm-staff-config.defaults';
import {
  CrmStaffRow,
  CrmStaffSummaryMeta,
  CrmStaffWorkspaceCase,
  CrmStaffWorkspaceResponse,
  PatchCrmStaffBody,
  StaffImportRow,
  staffRowForApi,
} from './crm-staff.types';

const STAFF_PIPELINE_SUB = `(SELECT COUNT(*)::int FROM crm_cases c
  WHERE c.assigned_staff_id = s.id AND c.status != 'dong') AS pipeline_case_count`;

const STAFF_FROM = `
FROM crm_staff s
LEFT JOIN crm_departments d ON d.id = s.department_id
LEFT JOIN crm_staff mgr ON mgr.id = s.reports_to_id
LEFT JOIN crm_positions pos ON pos.id = s.position_id
`;

@Injectable()
export class CrmStaffPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private staffTableExists: boolean | null = null;
  private casesTableExists: boolean | null = null;
  private settingsTableExists: boolean | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly ingestRules: LeadIngestRulesRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.staffTableExists = null;
    this.casesTableExists = null;
    this.settingsTableExists = null;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
       LIMIT 1`,
      [tableName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async hasStaffTable(): Promise<boolean> {
    if (this.staffTableExists != null) return this.staffTableExists;
    this.staffTableExists = await this.tableExists('crm_staff');
    return this.staffTableExists;
  }

  private async hasCasesTable(): Promise<boolean> {
    if (this.casesTableExists != null) return this.casesTableExists;
    this.casesTableExists = await this.tableExists('crm_cases');
    return this.casesTableExists;
  }

  private async hasSettingsTable(): Promise<boolean> {
    if (this.settingsTableExists != null) return this.settingsTableExists;
    this.settingsTableExists = await this.tableExists('crm_staff_settings');
    return this.settingsTableExists;
  }

  private async staffTableHasRows(): Promise<boolean> {
    if (!(await this.hasStaffTable())) return false;
    const result = await this.db.query(`SELECT 1 FROM crm_staff LIMIT 1`);
    return (result.rowCount ?? 0) > 0;
  }

  private async listStaffFromIngest(limit: number): Promise<{
    staff: CrmStaffRow[];
    summary: CrmStaffSummaryMeta;
    meta: Record<string, number>;
  }> {
    const rows = await this.ingestRules.listActiveStaff(limit);
    const staff: CrmStaffRow[] = rows.map((row, index) => ({
      id: row.id,
      name: row.name,
      phone: '',
      email: '',
      job_title: row.sales_level ?? '',
      department: '',
      internal_code: String(row.id),
      active: 1,
      notes: '',
      sort_order: index,
      department_id: null,
      position_id: null,
      reports_to_id: null,
      employment_type: '',
      started_on: '',
      ended_on: '',
      created: '',
      updated_at: '',
      pipeline_case_count: 0,
      dept_code: '',
      dept_name: '',
      reports_to_name: '',
      position_catalog_name: '',
      position_catalog_code: '',
      has_login: false,
    }));
    const total = staff.length;
    return {
      staff,
      summary: {
        staff_total: total,
        staff_active: total,
        staff_inactive: 0,
        open_assigned_cases: 0,
      },
      meta: {
        page: 1,
        per_page: Math.max(total, 1),
        total,
        total_pages: 1,
      },
    };
  }

  async listStaff(limit = 500): Promise<{
    staff: CrmStaffRow[];
    summary: CrmStaffSummaryMeta;
    meta: Record<string, number>;
  }> {
    if (!(await this.staffTableHasRows())) {
      return this.listStaffFromIngest(limit);
    }

    const lim = Math.max(1, Math.min(limit, 1000));
    const rowsResult = await this.db.query(
      `SELECT s.*, ${STAFF_PIPELINE_SUB},
              d.code AS dept_code, d.name AS dept_name,
              mgr.name AS reports_to_name,
              pos.name AS position_catalog_name,
              pos.code AS position_catalog_code
       ${STAFF_FROM}
       WHERE s.active = TRUE
       ORDER BY s.sort_order ASC, lower(s.name) ASC
       LIMIT $1`,
      [lim],
    );

    let openAssigned = 0;
    if (await this.hasCasesTable()) {
      const sumCases = await this.db.query(
        `SELECT COUNT(*)::int AS n FROM crm_cases
         WHERE assigned_staff_id IS NOT NULL AND status != 'dong'`,
      );
      openAssigned = Number(sumCases.rows[0]?.n ?? 0);
    }

    const sumRow = await this.db.query(
      `SELECT
         COUNT(*)::int AS staff_total,
         COUNT(*) FILTER (WHERE active = TRUE)::int AS staff_active,
         COUNT(*) FILTER (WHERE active = FALSE)::int AS staff_inactive
       FROM crm_staff`,
    );
    const sum = sumRow.rows[0] as Record<string, number>;

    const staff = (rowsResult.rows as Array<Record<string, unknown>>).map((r) =>
      staffRowForApi(r),
    );
    const total = staff.length;
    return {
      staff,
      summary: {
        staff_total: Number(sum.staff_total ?? 0),
        staff_active: Number(sum.staff_active ?? 0),
        staff_inactive: Number(sum.staff_inactive ?? 0),
        open_assigned_cases: openAssigned,
      },
      meta: {
        page: 1,
        per_page: Math.max(total, 1),
        total,
        total_pages: 1,
      },
    };
  }

  async getStaffById(staffId: number): Promise<CrmStaffRow | null> {
    if (!(await this.staffTableHasRows())) {
      const bundle = await this.listStaffFromIngest(1000);
      return bundle.staff.find((row) => row.id === staffId) ?? null;
    }

    const result = await this.db.query(
      `SELECT s.*, ${STAFF_PIPELINE_SUB},
              d.code AS dept_code, d.name AS dept_name,
              mgr.name AS reports_to_name,
              pos.name AS position_catalog_name,
              pos.code AS position_catalog_code
       ${STAFF_FROM}
       WHERE s.id = $1 OR s.sqlite_staff_id = $1
       LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? staffRowForApi(row) : null;
  }

  async patchStaff(staffId: number, body: PatchCrmStaffBody): Promise<CrmStaffRow | null> {
    const existingResult = await this.db.query(`SELECT * FROM crm_staff WHERE id = $1`, [staffId]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, unknown> = { ...existing };
    if ('name' in body && typeof body.name === 'string') {
      merged.name = body.name.trim().slice(0, 240);
    }
    if ('phone' in body && typeof body.phone === 'string') {
      merged.phone = body.phone.trim().slice(0, 80);
    }
    if ('email' in body && typeof body.email === 'string') {
      merged.email = body.email.trim().slice(0, 240);
    }
    if ('job_title' in body && typeof body.job_title === 'string') {
      merged.job_title = body.job_title.trim().slice(0, 200);
    }

    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_staff
       SET name = $1, phone = $2, email = $3, job_title = $4, updated_at = $5
       WHERE id = $6`,
      [
        String(merged.name ?? ''),
        String(merged.phone ?? ''),
        String(merged.email ?? ''),
        String(merged.job_title ?? ''),
        ts,
        staffId,
      ],
    );

    await this.ingestRules.syncStaffRowsFromRoster();
    return this.getStaffById(staffId);
  }

  async getWorkspace(staffId: number): Promise<CrmStaffWorkspaceResponse | null> {
    const staffRowResult = await this.db.query(
      `SELECT id, name, phone, email, job_title, department, active
       FROM crm_staff
       WHERE id = $1 OR sqlite_staff_id = $1
       LIMIT 1`,
      [staffId],
    );
    const staffRow = staffRowResult.rows[0] as Record<string, unknown> | undefined;
    if (!staffRow) return null;

    let caseRows: Array<Record<string, unknown>> = [];
    if (await this.hasCasesTable()) {
      const caseResult = await this.db.query(
        `SELECT c.id, c.title, c.pipeline_stage, COALESCE(c.deal_value_vnd, 0) AS deal_value_vnd,
                c.status, c.assigned_staff_id, c.customer_id, c.created_at, c.updated_at,
                c.priority, c.assigned_at,
                cu.name AS customer_name, st.name AS staff_name
         FROM crm_cases c
         LEFT JOIN crm_customers cu ON cu.id = c.customer_id
         LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id
         WHERE c.assigned_staff_id = $1
         ORDER BY c.updated_at DESC
         LIMIT 200`,
        [Number(staffRow.id)],
      );
      caseRows = caseResult.rows as Array<Record<string, unknown>>;
    }

    const cases: CrmStaffWorkspaceCase[] = caseRows.map((r) => ({
      id: Number(r.id),
      title: String(r.title ?? ''),
      pipeline_stage: normalizePipelineStage(String(r.pipeline_stage ?? r.status ?? '')),
      deal_value_vnd: Number(r.deal_value_vnd ?? 0),
      status: String(r.status ?? ''),
      assigned_staff_id: r.assigned_staff_id != null ? Number(r.assigned_staff_id) : null,
      customer_id: r.customer_id != null ? Number(r.customer_id) : null,
      customer_name: String(r.customer_name ?? ''),
      staff_name: String(r.staff_name ?? ''),
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      priority: String(r.priority ?? ''),
    }));

    const openCases = cases.filter(
      (c) => !TERMINAL_STAGES.has(normalizePipelineStage(c.pipeline_stage)),
    );
    const todayPrefix = new Date().toISOString().slice(0, 10);

    return {
      staff: {
        id: Number(staffRow.id),
        name: String(staffRow.name ?? ''),
        phone: String(staffRow.phone ?? ''),
        email: String(staffRow.email ?? ''),
        job_title: String(staffRow.job_title ?? ''),
        department: String(staffRow.department ?? ''),
        active: staffRow.active === true || staffRow.active === 1 ? 1 : 0,
      },
      stats: {
        total_assigned: openCases.length,
        open: openCases.length,
        high_priority: openCases.filter((c) => c.priority === 'cao').length,
        sla_overdue: 0,
        new_today: openCases.filter((c) =>
          String(caseRows.find((r) => Number(r.id) === c.id)?.assigned_at ?? '').startsWith(
            todayPrefix,
          ),
        ).length,
        no_care_report: 0,
      },
      cases: openCases,
    };
  }

  private async loadStaffConfigRaw(): Promise<Record<string, unknown>> {
    const cfg: Record<string, unknown> = {
      staff_levels: DEFAULT_STAFF_LEVELS.map((d) => ({ ...d })),
      competency: { ...DEFAULT_COMPETENCY_CONFIG },
    };
    if (!(await this.hasSettingsTable())) return cfg;

    const result = await this.db.query(
      `SELECT config_json FROM crm_staff_settings WHERE config_key = 'global' LIMIT 1`,
    );
    const row = result.rows[0] as { config_json: unknown } | undefined;
    if (!row) return cfg;

    try {
      const raw =
        typeof row.config_json === 'string'
          ? (JSON.parse(row.config_json) as Record<string, unknown>)
          : (row.config_json as Record<string, unknown>);
      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.staff_levels) && raw.staff_levels.length) {
          cfg.staff_levels = raw.staff_levels;
        }
        if (raw.competency && typeof raw.competency === 'object') {
          cfg.competency = raw.competency;
        }
      }
    } catch {
      /* keep defaults */
    }
    return cfg;
  }

  private async saveStaffConfigPartial(partial: Record<string, unknown>): Promise<Record<string, unknown>> {
    const merged = await this.loadStaffConfigRaw();
    if ('staff_levels' in partial) merged.staff_levels = partial.staff_levels;
    if ('competency' in partial) merged.competency = partial.competency;
    const ts = catalogTs();

    if (await this.hasSettingsTable()) {
      await this.db.query(
        `INSERT INTO crm_staff_settings (config_key, config_json, updated_at, updated_by)
         VALUES ('global', $1::jsonb, $2, 'nest-api')
         ON CONFLICT (config_key) DO UPDATE SET
           config_json = EXCLUDED.config_json,
           updated_at = EXCLUDED.updated_at,
           updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(merged), ts],
      );
    }
    return merged;
  }

  async getStaffLevels() {
    const cfg = await this.loadStaffConfigRaw();
    return {
      staff_levels: cfg.staff_levels ?? DEFAULT_STAFF_LEVELS,
      defaults: DEFAULT_STAFF_LEVELS,
    };
  }

  async saveStaffLevels(levels: Array<Record<string, unknown>>) {
    if (!Array.isArray(levels)) {
      throw new Error('INVALID_LEVELS');
    }
    const cfg = await this.saveStaffConfigPartial({ staff_levels: levels });
    return { staff_levels: cfg.staff_levels ?? levels };
  }

  async getCompetencyConfig() {
    const cfg = await this.loadStaffConfigRaw();
    return {
      competency: cfg.competency ?? DEFAULT_COMPETENCY_CONFIG,
      defaults: DEFAULT_COMPETENCY_CONFIG,
      metric_options: COMPETENCY_METRIC_OPTIONS,
    };
  }

  async saveCompetencyConfig(competency: Record<string, unknown>) {
    const cfg = await this.saveStaffConfigPartial({ competency });
    return { competency: cfg.competency ?? competency };
  }

  async importStaffRows(rows: StaffImportRow[]): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const ts = catalogTs();
    const shortDate = new Date().toISOString().slice(0, 10);

    for (const row of rows) {
      const name = String(row.name ?? '').trim().slice(0, 240);
      if (!name) {
        skipped += 1;
        continue;
      }
      const internalCode = String(row.internal_code ?? '').trim().slice(0, 80);
      const email = String(row.email ?? '').trim().slice(0, 240);
      const phone = String(row.phone ?? '').trim().slice(0, 80);
      const jobTitle = String(row.job_title ?? '').trim().slice(0, 200);

      let existingId: number | null = null;
      if (internalCode) {
        const hit = await this.db.query(
          `SELECT id FROM crm_staff WHERE trim(internal_code) = $1 LIMIT 1`,
          [internalCode],
        );
        if (hit.rows[0]) existingId = Number(hit.rows[0].id);
      }
      if (existingId == null && email) {
        const hit = await this.db.query(
          `SELECT id FROM crm_staff WHERE lower(trim(email)) = lower($1) LIMIT 1`,
          [email],
        );
        if (hit.rows[0]) existingId = Number(hit.rows[0].id);
      }

      if (existingId != null) {
        await this.db.query(
          `UPDATE crm_staff
           SET name = $1, phone = $2, email = $3, job_title = $4, internal_code = $5, updated_at = $6
           WHERE id = $7`,
          [name, phone, email, jobTitle, internalCode, ts, existingId],
        );
        updated += 1;
      } else {
        await this.db.query(
          `INSERT INTO crm_staff (
             name, phone, email, job_title, internal_code, active, created_at, updated_at, started_on
           ) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $6, $7::date)`,
          [name, phone, email, jobTitle, internalCode, ts, shortDate],
        );
        created += 1;
      }
    }

    await this.ingestRules.syncStaffRowsFromRoster();
    return { created, updated, skipped };
  }

  async staffExists(staffId: number): Promise<boolean> {
    if (!Number.isFinite(staffId) || staffId <= 0) return false;

    if (await this.staffTableHasRows()) {
      const result = await this.db.query(
        `SELECT 1 FROM crm_staff
         WHERE (id = $1 OR sqlite_staff_id = $1) AND active = TRUE
         LIMIT 1`,
        [staffId],
      );
      if ((result.rowCount ?? 0) > 0) return true;
    }

    return this.ingestRules.staffExists(staffId);
  }
}
