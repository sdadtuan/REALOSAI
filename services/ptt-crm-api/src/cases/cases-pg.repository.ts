import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { mapCareReportRow, mapCaseRow } from './cases-pg.mapper';
import {
  CareReportRow,
  CaseEventRow,
  CaseRow,
  CreateCareReportBody,
  CRM_STATUSES,
  normalizeCareContact,
  normalizeCareStatus,
  normalizeCaseChannel,
  normalizeCasePriority,
  normalizeCaseStatus,
  PatchCaseBody,
} from './cases.types';

const CASE_SELECT = `
SELECT c.id, c.sqlite_case_id, c.customer_id, c.title, c.description,
       c.channel, c.priority, c.status, c.assigned_to, c.assigned_staff_id,
       c.assigned_at, c.pipeline_stage, c.campaign_id, c.created_at, c.updated_at,
       cu.name AS customer_name,
       cu.phone AS customer_phone,
       cu.email AS customer_email,
       cu.address AS customer_address,
       cu.company AS customer_company,
       COALESCE(cu.sqlite_customer_id, cu.id) AS customer_legacy_id,
       st.name AS staff_display_name
FROM crm_cases c
JOIN crm_customers cu ON cu.id = c.customer_id
LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id
`;

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

@Injectable()
export class CasesPgRepository implements OnModuleDestroy {
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

  private async resolveCasePgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_case_id FROM crm_cases
       WHERE sqlite_case_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_case_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_case_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_case_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
  }

  async listCases(staffId?: number): Promise<CaseRow[]> {
    let result;
    if (staffId != null && Number.isFinite(staffId)) {
      result = await this.db.query(
        `${CASE_SELECT}
         WHERE c.assigned_staff_id = $1
         ORDER BY c.updated_at DESC`,
        [staffId],
      );
    } else {
      result = await this.db.query(`${CASE_SELECT} ORDER BY c.updated_at DESC`);
    }
    return (result.rows as Array<Record<string, unknown>>).map((row) => mapCaseRow(row));
  }

  async getCaseById(caseId: number): Promise<CaseRow | null> {
    const result = await this.db.query(
      `${CASE_SELECT}
       WHERE c.sqlite_case_id = $1 OR c.id = $1
       ORDER BY CASE WHEN c.sqlite_case_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [caseId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCaseRow(row) : null;
  }

  async patchCase(caseId: number, body: PatchCaseBody): Promise<CaseRow | null> {
    const resolved = await this.resolveCasePgId(caseId);
    if (!resolved) return null;
    const { pgId, legacyId } = resolved;

    const existingResult = await this.db.query(`SELECT * FROM crm_cases WHERE id = $1`, [pgId]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, unknown> = { ...existing };
    if ('title' in body && typeof body.title === 'string') {
      merged.title = body.title.trim().slice(0, 800);
    }
    if ('description' in body && typeof body.description === 'string') {
      merged.description = body.description.trim().slice(0, 8000);
    }
    if ('status' in body) {
      merged.status = normalizeCaseStatus(body.status);
    }
    if ('priority' in body) {
      merged.priority = normalizeCasePriority(body.priority);
    }
    if ('pipeline_stage' in body && typeof body.pipeline_stage === 'string') {
      merged.pipeline_stage = body.pipeline_stage.trim().slice(0, 64);
    }
    if ('channel' in body) {
      merged.channel = normalizeCaseChannel(body.channel);
    }
    if ('assigned_staff_id' in body || 'assigned_to' in body) {
      const rawId = body.assigned_staff_id;
      if (rawId == null || rawId === 0) {
        merged.assigned_staff_id = null;
        merged.assigned_to = String(body.assigned_to ?? '').trim().slice(0, 240);
        merged.assigned_at = null;
      } else {
        const aid = Number(rawId);
        if (Number.isFinite(aid) && aid > 0) {
          merged.assigned_staff_id = aid;
          const staffResult = await this.db.query(
            `SELECT name FROM crm_staff WHERE id = $1 LIMIT 1`,
            [aid],
          );
          const staffRow = staffResult.rows[0] as { name?: string } | undefined;
          merged.assigned_to = String(staffRow?.name ?? body.assigned_to ?? '').slice(0, 240);
          merged.assigned_at = catalogTs();
        }
      }
    }

    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_cases
       SET title = $1, description = $2, channel = $3, priority = $4, status = $5,
           assigned_to = $6, assigned_staff_id = $7, assigned_at = $8::timestamptz,
           pipeline_stage = $9, updated_at = $10::timestamptz
       WHERE id = $11`,
      [
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.channel ?? ''),
        String(merged.priority ?? ''),
        String(merged.status ?? ''),
        String(merged.assigned_to ?? ''),
        merged.assigned_staff_id != null ? Number(merged.assigned_staff_id) : null,
        merged.assigned_at ? String(merged.assigned_at) : null,
        String(merged.pipeline_stage ?? ''),
        ts,
        pgId,
      ],
    );
    return this.getCaseById(legacyId);
  }

  async listEvents(caseId: number): Promise<CaseEventRow[]> {
    const resolved = await this.resolveCasePgId(caseId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT id, sqlite_event_id, case_id, kind, body, created_at
       FROM crm_case_events
       WHERE case_id = $1
       ORDER BY id ASC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.sqlite_event_id ?? row.id),
      case_id: resolved.legacyId,
      kind: String(row.kind ?? ''),
      body: String(row.body ?? ''),
      created_at: formatTs(row.created_at),
    }));
  }

  async createEvent(caseId: number, body: string): Promise<CaseEventRow> {
    const resolved = await this.resolveCasePgId(caseId);
    if (!resolved) {
      throw new Error('Case not found');
    }
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_case_events (case_id, kind, body, created_at)
       VALUES ($1, 'ghi_chu', $2, $3::timestamptz)
       RETURNING id`,
      [resolved.pgId, body, ts],
    );
    const eventPgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_case_events SET sqlite_event_id = id
       WHERE id = $1 AND sqlite_event_id IS NULL`,
      [eventPgId],
    );
    await this.db.query(`UPDATE crm_cases SET updated_at = $1::timestamptz WHERE id = $2`, [
      ts,
      resolved.pgId,
    ]);
    const rowResult = await this.db.query(
      `SELECT id, sqlite_event_id, case_id, kind, body, created_at
       FROM crm_case_events WHERE id = $1`,
      [eventPgId],
    );
    const row = rowResult.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.sqlite_event_id ?? row.id),
      case_id: resolved.legacyId,
      kind: String(row.kind ?? ''),
      body: String(row.body ?? ''),
      created_at: formatTs(row.created_at),
    };
  }

  async listCareReports(caseId: number, limit = 50): Promise<CareReportRow[]> {
    const resolved = await this.resolveCasePgId(caseId);
    if (!resolved) return [];
    const lim = Math.max(1, Math.min(limit, 200));
    const result = await this.db.query(
      `SELECT * FROM crm_care_reports
       WHERE case_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [resolved.pgId, lim],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapCareReportRow(row, resolved.legacyId),
    );
  }

  async createCareReport(caseId: number, body: CreateCareReportBody): Promise<CareReportRow> {
    const resolved = await this.resolveCasePgId(caseId);
    if (!resolved) {
      throw new Error('Case not found');
    }
    const caseRow = await this.getCaseById(resolved.legacyId);
    if (!caseRow) {
      throw new Error('Case not found');
    }

    let staffId: number | null = null;
    if (body.staff_id != null && body.staff_id !== 0) {
      staffId = Number(body.staff_id);
      if (!Number.isFinite(staffId)) staffId = null;
    }
    let staffName = '';
    if (staffId) {
      const staffResult = await this.db.query(
        `SELECT name FROM crm_staff WHERE id = $1 AND active = 1 LIMIT 1`,
        [staffId],
      );
      const srow = staffResult.rows[0] as { name?: string } | undefined;
      if (srow) {
        staffName = String(srow.name);
      } else {
        staffId = null;
      }
    }
    if (!staffId && caseRow.assigned_staff_id) {
      staffId = caseRow.assigned_staff_id;
      staffName = caseRow.staff_display_name || caseRow.assigned_to;
    }

    const contactType = normalizeCareContact(body.contact_type);
    const careStatus = normalizeCareStatus(body.care_status);
    const summary = String(body.summary ?? '').trim().slice(0, 4000);
    const nextAction = String(body.next_action ?? '').trim().slice(0, 800);
    const ts = catalogTs();

    const insert = await this.db.query(
      `INSERT INTO crm_care_reports (
         case_id, staff_id, staff_name, contact_type, care_status,
         summary, next_action, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
       RETURNING id`,
      [resolved.pgId, staffId, staffName, contactType, careStatus, summary, nextAction, ts],
    );
    const reportPgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_care_reports SET sqlite_report_id = id
       WHERE id = $1 AND sqlite_report_id IS NULL`,
      [reportPgId],
    );
    await this.db.query(`UPDATE crm_cases SET updated_at = $1::timestamptz WHERE id = $2`, [
      ts,
      resolved.pgId,
    ]);

    const rowResult = await this.db.query(`SELECT * FROM crm_care_reports WHERE id = $1`, [
      reportPgId,
    ]);
    return mapCareReportRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  isValidStatus(status: string): boolean {
    return (CRM_STATUSES as readonly string[]).includes(status);
  }
}
