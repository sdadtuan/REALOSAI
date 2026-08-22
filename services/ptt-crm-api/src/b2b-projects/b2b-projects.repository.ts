import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { ChannelKeyRow } from './b2b-channel-unique.util';
import type {
  B2bProjectChannelInput,
  B2bProjectPageInput,
  B2bProjectRow,
  B2bProjectStaffInput,
} from './b2b-projects.types';

@Injectable()
export class B2bProjectsRepository implements OnModuleDestroy {
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

  async tablesReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_b2b_projects' LIMIT 1`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async listProjects(status?: string): Promise<B2bProjectRow[]> {
    const params: unknown[] = [];
    let where = '';
    if (status?.trim()) {
      where = ' WHERE status = $1';
      params.push(status.trim());
    }
    const result = await this.db.query(
      `SELECT id::text, owner_company_id::text, code, name, status,
              business_hours_json, sla_json, commission_json,
              ai_call_enabled, manual_ingest_enabled,
              created_at::text, updated_at::text
       FROM crm_b2b_projects${where}
       ORDER BY code ASC`,
      params,
    );
    return result.rows as B2bProjectRow[];
  }

  async getProject(id: string): Promise<B2bProjectRow | null> {
    const result = await this.db.query(
      `SELECT id::text, owner_company_id::text, code, name, status,
              business_hours_json, sla_json, commission_json,
              ai_call_enabled, manual_ingest_enabled,
              created_at::text, updated_at::text
       FROM crm_b2b_projects WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    return (result.rows[0] as B2bProjectRow | undefined) ?? null;
  }

  async insertProject(row: {
    owner_company_id: string;
    code: string;
    name: string;
  }): Promise<B2bProjectRow> {
    const result = await this.db.query(
      `INSERT INTO crm_b2b_projects (owner_company_id, code, name)
       VALUES ($1::uuid, $2, $3)
       RETURNING id::text, owner_company_id::text, code, name, status,
                 business_hours_json, sla_json, commission_json,
                 ai_call_enabled, manual_ingest_enabled,
                 created_at::text, updated_at::text`,
      [row.owner_company_id, row.code, row.name],
    );
    return result.rows[0] as B2bProjectRow;
  }

  async patchProject(id: string, patch: Record<string, unknown>): Promise<B2bProjectRow | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };
    if (patch.name != null) push('name = ?', String(patch.name));
    if (patch.status != null) push('status = ?', String(patch.status));
    if (patch.business_hours_json != null) {
      push('business_hours_json = ?::jsonb', JSON.stringify(patch.business_hours_json));
    }
    if (patch.sla_json != null) push('sla_json = ?::jsonb', JSON.stringify(patch.sla_json));
    if (patch.commission_json != null) {
      push('commission_json = ?::jsonb', JSON.stringify(patch.commission_json));
    }
    if (patch.ai_call_enabled != null) push('ai_call_enabled = ?', Boolean(patch.ai_call_enabled));
    if (patch.manual_ingest_enabled != null) {
      push('manual_ingest_enabled = ?', Boolean(patch.manual_ingest_enabled));
    }
    if (sets.length === 1) return this.getProject(id);
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_b2b_projects SET ${sets.join(', ')} WHERE id = $${params.length}::uuid
       RETURNING id::text, owner_company_id::text, code, name, status,
                 business_hours_json, sla_json, commission_json,
                 ai_call_enabled, manual_ingest_enabled,
                 created_at::text, updated_at::text`,
      params,
    );
    return (result.rows[0] as B2bProjectRow | undefined) ?? null;
  }

  async listActiveChannelKeys(): Promise<ChannelKeyRow[]> {
    const rows: ChannelKeyRow[] = [];
    const pages = await this.db.query(
      `SELECT page_id, project_id::text AS project_id, active FROM crm_b2b_project_pages`,
    );
    for (const row of pages.rows) {
      rows.push({
        kind: 'page_id',
        value: String(row.page_id),
        projectId: String(row.project_id),
        active: Boolean(row.active),
      });
    }
    const forms = await this.db.query(
      `SELECT f.form_id, p.project_id::text AS project_id, f.active
       FROM crm_b2b_project_page_forms f
       JOIN crm_b2b_project_pages p ON p.id = f.page_row_id`,
    );
    for (const row of forms.rows) {
      rows.push({
        kind: 'form_id',
        value: String(row.form_id),
        projectId: String(row.project_id),
        active: Boolean(row.active),
      });
    }
    const accounts = await this.db.query(
      `SELECT channel_type, external_key, project_id::text AS project_id, active
       FROM crm_b2b_project_channel_accounts`,
    );
    for (const row of accounts.rows) {
      const kind =
        row.channel_type === 'zalo'
          ? 'oa_id'
          : row.channel_type === 'webform'
            ? 'webform_slug'
            : 'api_key_hash';
      rows.push({
        kind,
        value: String(row.external_key),
        projectId: String(row.project_id),
        active: Boolean(row.active),
      });
    }
    return rows;
  }

  async replacePages(projectId: string, pages: B2bProjectPageInput[]): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM crm_b2b_project_pages WHERE project_id = $1::uuid`, [projectId]);
      for (const page of pages) {
        const pageResult = await client.query(
          `INSERT INTO crm_b2b_project_pages (project_id, page_id, name, token_ref, active)
           VALUES ($1::uuid, $2, $3, $4, $5)
           RETURNING id`,
          [
            projectId,
            page.page_id.trim(),
            page.name?.trim() || '',
            page.token_ref ?? null,
            page.active !== false,
          ],
        );
        const pageRowId = pageResult.rows[0].id;
        for (const form of page.forms ?? []) {
          await client.query(
            `INSERT INTO crm_b2b_project_page_forms (page_row_id, form_id, name, active)
             VALUES ($1::uuid, $2, $3, $4)`,
            [pageRowId, form.form_id.trim(), form.name?.trim() || '', form.active !== false],
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async replaceChannels(projectId: string, channels: B2bProjectChannelInput[]): Promise<void> {
    await this.db.query(`DELETE FROM crm_b2b_project_channel_accounts WHERE project_id = $1::uuid`, [
      projectId,
    ]);
    for (const ch of channels) {
      await this.db.query(
        `INSERT INTO crm_b2b_project_channel_accounts
           (project_id, channel_type, external_key, label, config_json, active)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6)`,
        [
          projectId,
          ch.channel_type,
          ch.external_key.trim(),
          ch.label?.trim() || '',
          JSON.stringify(ch.config_json ?? {}),
          ch.active !== false,
        ],
      );
    }
  }

  async replaceStaff(projectId: string, staff: B2bProjectStaffInput[]): Promise<void> {
    await this.db.query(`DELETE FROM crm_b2b_project_staff WHERE project_id = $1::uuid`, [projectId]);
    for (const row of staff) {
      await this.db.query(
        `INSERT INTO crm_b2b_project_staff (project_id, staff_id, assign_enabled, sales_level, role)
         VALUES ($1::uuid, $2, $3, $4, $5)`,
        [
          projectId,
          Number(row.staff_id),
          row.assign_enabled !== false,
          (row.sales_level ?? 'b').trim().toLowerCase(),
          (row.role ?? 'sales').trim().toLowerCase() === 'project_manager'
            ? 'project_manager'
            : 'sales',
        ],
      );
    }
  }

  async listStaffMemberships(
    staffId: number,
  ): Promise<Array<{ projectId: string; assignEnabled: boolean; role: 'sales' | 'project_manager' }>> {
    const result = await this.db.query(
      `SELECT project_id::text AS project_id, assign_enabled, COALESCE(role, 'sales') AS role
       FROM crm_b2b_project_staff WHERE staff_id = $1`,
      [staffId],
    );
    return result.rows.map((row) => ({
      projectId: String(row.project_id),
      assignEnabled: Boolean(row.assign_enabled),
      role: String(row.role ?? 'sales') === 'project_manager' ? 'project_manager' : 'sales',
    }));
  }

  async findStaffActive(staffId: number): Promise<{ active: boolean | null }> {
    const result = await this.db.query(`SELECT active FROM crm_staff WHERE id = $1 LIMIT 1`, [staffId]);
    const raw = result.rows[0]?.active;
    if (raw == null) return { active: null };
    return { active: Boolean(raw) };
  }

  async loadIngressCatalog(): Promise<import('./b2b-ingest.util').IngressCatalog> {
    const formsResult = await this.db.query(
      `SELECT f.form_id, p.page_id, p.project_id::text AS project_id, pr.code AS project_slug, f.active
       FROM crm_b2b_project_page_forms f
       JOIN crm_b2b_project_pages p ON p.id = f.page_row_id
       JOIN crm_b2b_projects pr ON pr.id = p.project_id`,
    );
    const pagesResult = await this.db.query(
      `SELECT p.page_id, p.project_id::text AS project_id, pr.code AS project_slug, p.active
       FROM crm_b2b_project_pages p
       JOIN crm_b2b_projects pr ON pr.id = p.project_id`,
    );
    const accountsResult = await this.db.query(
      `SELECT channel_type, external_key, project_id::text AS project_id, pr.code AS project_slug, a.active
       FROM crm_b2b_project_channel_accounts a
       JOIN crm_b2b_projects pr ON pr.id = a.project_id`,
    );
    return {
      forms: formsResult.rows.map((row) => ({
        formId: String(row.form_id),
        pageId: String(row.page_id),
        projectId: String(row.project_id),
        projectSlug: String(row.project_slug).toLowerCase(),
        active: Boolean(row.active),
      })),
      pages: pagesResult.rows.map((row) => ({
        pageId: String(row.page_id),
        projectId: String(row.project_id),
        projectSlug: String(row.project_slug).toLowerCase(),
        active: Boolean(row.active),
      })),
      accounts: accountsResult.rows.map((row) => ({
        channel: String(row.channel_type) as 'zalo' | 'webform' | 'api',
        externalKey: String(row.external_key),
        projectId: String(row.project_id),
        projectSlug: String(row.project_slug).toLowerCase(),
        active: Boolean(row.active),
      })),
    };
  }

  async insertUnmatchedIngress(input: {
    channel: string;
    projectSlug?: string;
    externalKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_b2b_unmatched_ingress (channel, project_slug, external_key, payload_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [input.channel, input.projectSlug ?? null, input.externalKey, JSON.stringify(input.payload)],
    );
  }

  async listUnmatched(input: { limit?: number; since?: string }): Promise<
    Array<{
      id: string;
      channel: string;
      project_slug: string | null;
      external_key: string;
      created_at: string;
    }>
  > {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const params: unknown[] = [];
    let where = '';
    if (input.since?.trim()) {
      params.push(input.since.trim());
      where = ` WHERE created_at >= $${params.length}::timestamptz`;
    }
    params.push(limit);
    const result = await this.db.query(
      `SELECT id::text, channel, project_slug, external_key, created_at::text
       FROM crm_b2b_unmatched_ingress${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      project_slug: row.project_slug ? String(row.project_slug) : null,
      external_key: String(row.external_key),
      created_at: String(row.created_at),
    }));
  }

  async getUnmatchedById(id: string): Promise<{
    id: string;
    channel: string;
    project_slug: string | null;
    external_key: string;
    created_at: string;
  } | null> {
    const result = await this.db.query(
      `SELECT id::text, channel, project_slug, external_key, created_at::text
       FROM crm_b2b_unmatched_ingress WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      channel: String(row.channel),
      project_slug: row.project_slug ? String(row.project_slug) : null,
      external_key: String(row.external_key),
      created_at: String(row.created_at),
    };
  }

  async deleteUnmatched(id: string): Promise<void> {
    await this.db.query(`DELETE FROM crm_b2b_unmatched_ingress WHERE id = $1::uuid`, [id]);
  }

  async attachFormToProject(input: {
    projectId: string;
    pageId: string;
    formId: string;
  }): Promise<void> {
    let pageRow = await this.db.query(
      `SELECT id FROM crm_b2b_project_pages
       WHERE project_id = $1::uuid AND page_id = $2 LIMIT 1`,
      [input.projectId, input.pageId],
    );
    let pageRowId = pageRow.rows[0]?.id as string | undefined;
    if (!pageRowId) {
      const inserted = await this.db.query(
        `INSERT INTO crm_b2b_project_pages (project_id, page_id, name, active)
         VALUES ($1::uuid, $2, $3, TRUE)
         RETURNING id`,
        [input.projectId, input.pageId, input.pageId],
      );
      pageRowId = String(inserted.rows[0].id);
    }
    const existingForm = await this.db.query(
      `SELECT 1 FROM crm_b2b_project_page_forms f
       JOIN crm_b2b_project_pages p ON p.id = f.page_row_id
       WHERE p.project_id = $1::uuid AND f.form_id = $2 AND f.active LIMIT 1`,
      [input.projectId, input.formId.trim()],
    );
    if ((existingForm.rowCount ?? 0) === 0) {
      await this.db.query(
        `INSERT INTO crm_b2b_project_page_forms (page_row_id, form_id, name, active)
         VALUES ($1::uuid, $2, $3, TRUE)`,
        [pageRowId, input.formId.trim(), input.formId.trim()],
      );
    }
  }

  async attachChannelAccount(input: {
    projectId: string;
    channelType: 'zalo' | 'webform' | 'api';
    externalKey: string;
    label?: string;
  }): Promise<void> {
    const existing = await this.db.query(
      `SELECT 1 FROM crm_b2b_project_channel_accounts
       WHERE channel_type = $1 AND external_key = $2 AND active LIMIT 1`,
      [input.channelType, input.externalKey.trim()],
    );
    if ((existing.rowCount ?? 0) > 0) return;
    await this.db.query(
      `INSERT INTO crm_b2b_project_channel_accounts
         (project_id, channel_type, external_key, label, active)
       VALUES ($1::uuid, $2, $3, $4, TRUE)`,
      [input.projectId, input.channelType, input.externalKey.trim(), input.label ?? ''],
    );
  }

  async listProjectPages(projectId: string) {
    const result = await this.db.query(
      `SELECT p.id::text, p.page_id, p.name, p.token_ref, p.active,
              COALESCE(
                json_agg(
                  json_build_object(
                    'form_id', f.form_id,
                    'name', f.name,
                    'active', f.active
                  )
                ) FILTER (WHERE f.id IS NOT NULL),
                '[]'::json
              ) AS forms
       FROM crm_b2b_project_pages p
       LEFT JOIN crm_b2b_project_page_forms f ON f.page_row_id = p.id
       WHERE p.project_id = $1::uuid
       GROUP BY p.id
       ORDER BY p.page_id`,
      [projectId],
    );
    return result.rows;
  }

  async listProjectChannels(projectId: string) {
    const result = await this.db.query(
      `SELECT id::text, channel_type, external_key, label, config_json, active
       FROM crm_b2b_project_channel_accounts
       WHERE project_id = $1::uuid
       ORDER BY channel_type, external_key`,
      [projectId],
    );
    return result.rows;
  }

  async listProjectStaff(projectId: string) {
    const result = await this.db.query(
      `SELECT staff_id, assign_enabled, sales_level, COALESCE(role, 'sales') AS role
       FROM crm_b2b_project_staff
       WHERE project_id = $1::uuid
       ORDER BY staff_id`,
      [projectId],
    );
    return result.rows;
  }
}
