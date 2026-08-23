import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { catalogTs } from '../../catalog/catalog-slug.util';
import { AppConfigService } from '../../config/app-config.service';
import type { BuyerLeadRow, CreateBuyerLeadBody } from './bds-buyer.types';
import { normalizePhoneE164 } from './bds-buyer.util';

const STAGING_ID_MIN = 900_000_000;

function parseMeta(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

@Injectable()
export class BdsBuyerLeadPgRepository implements OnModuleDestroy {
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

  private mapLead(row: Record<string, unknown>): BuyerLeadRow {
    const meta = parseMeta(row.meta_json);
    return {
      id: Number(row.sqlite_lead_id ?? row.id),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      status: String(row.status ?? 'moi'),
      re_project_id:
        row.re_project_id != null
          ? Number(row.re_project_id)
          : meta.re_project_id != null
            ? Number(meta.re_project_id)
            : null,
      tenant_id:
        meta.bds_tenant_id != null
          ? String(meta.bds_tenant_id)
          : row.tenant_id != null
            ? String(row.tenant_id)
            : null,
      owner_id: row.owner_id != null ? Number(row.owner_id) : null,
      channel_partner_id:
        meta.channel_partner_id != null ? String(meta.channel_partner_id) : null,
      meta_json: meta,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at != null ? String(row.created_at) : null,
      received_at: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at != null ? String(row.received_at) : null,
    };
  }

  private async nextLeadId(client: PoolClient): Promise<number> {
    if (this.config.leadsCreateIdMode === 'prod') {
      const result = await client.query(`SELECT nextval('crm_leads_prod_id_seq') AS next_id`);
      const id = Number(result.rows[0]?.next_id ?? 0);
      if (!Number.isFinite(id) || id <= 0 || id >= STAGING_ID_MIN) {
        throw new BadRequestException({
          error: 'prod_id_allocator_unavailable',
          hint: 'Apply ./scripts/apply_pg_ddl_v3_sprint0.sh',
        });
      }
      return id;
    }
    const result = await client.query(
      `SELECT COALESCE(MAX(sqlite_lead_id), $1 - 1) + 1 AS next_id
       FROM crm_leads WHERE sqlite_lead_id >= $1`,
      [STAGING_ID_MIN],
    );
    return Number(result.rows[0]?.next_id ?? STAGING_ID_MIN);
  }

  async findReBuyerByPhoneProject(input: {
    phone: string;
    reProjectId: number;
    tenantId: string;
  }): Promise<{ lead_id: number } | null> {
    const phone = normalizePhoneE164(input.phone);
    const res = await this.db.query(
      `SELECT sqlite_lead_id, phone, meta_json FROM crm_leads
       WHERE re_project_id = $1 AND COALESCE(is_duplicate, FALSE) = FALSE
       ORDER BY sqlite_lead_id ASC LIMIT 200`,
      [input.reProjectId],
    );
    for (const row of res.rows) {
      const meta = parseMeta(row.meta_json);
      if (String(meta.bds_tenant_id ?? '') !== input.tenantId) continue;
      if (normalizePhoneE164(String(row.phone ?? '')) !== phone) continue;
      if (String(meta.lead_flow_kind ?? '') !== 're_buyer') continue;
      return { lead_id: Number(row.sqlite_lead_id) };
    }
    return null;
  }

  async patchLeadMeta(leadId: number, patch: Record<string, unknown>): Promise<void> {
    const res = await this.db.query(`SELECT meta_json FROM crm_leads WHERE sqlite_lead_id = $1`, [
      leadId,
    ]);
    if (!res.rows[0]) return;
    const meta = { ...parseMeta(res.rows[0].meta_json), ...patch };
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_leads
       SET meta_json = $1::jsonb, updated_at = $2::timestamptz, synced_at = NOW(),
           write_source = 'nest', sync_version = sync_version + 1
       WHERE sqlite_lead_id = $3`,
      [JSON.stringify(meta), ts, leadId],
    );
  }

  async setLeadStatus(leadId: number, status: string): Promise<void> {
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_leads
       SET status = $1, updated_at = $2::timestamptz, synced_at = NOW(),
           write_source = 'nest', sync_version = sync_version + 1
       WHERE sqlite_lead_id = $3`,
      [status, ts, leadId],
    );
  }

  async getLeadForScope(leadId: number): Promise<BuyerLeadRow | null> {
    const res = await this.db.query(
      `SELECT sqlite_lead_id, full_name, phone, email, status, re_project_id, owner_id,
              meta_json, created_at, received_at
       FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapLead(row) : null;
  }

  async listByProject(projectId: number, tenantId?: string): Promise<BuyerLeadRow[]> {
    const res = await this.db.query(
      `SELECT sqlite_lead_id, full_name, phone, email, status, re_project_id, owner_id,
              meta_json, created_at, received_at
       FROM crm_leads
       WHERE re_project_id = $1 AND (meta_json ->> 'lead_flow_kind') = 're_buyer'
       ORDER BY sqlite_lead_id DESC LIMIT 500`,
      [projectId],
    );
    return res.rows
      .map((row) => this.mapLead(row as Record<string, unknown>))
      .filter((row) => !tenantId || row.tenant_id === tenantId);
  }

  async createLead(body: CreateBuyerLeadBody, tenantId: string): Promise<BuyerLeadRow> {
    const ts = catalogTs();
    const meta = {
      lead_flow_kind: 're_buyer',
      re_project_id: body.re_project_id,
      bds_tenant_id: tenantId,
      need_json: body.need_json ?? {},
      ...(body.re_product_id != null ? { re_product_id: body.re_product_id } : {}),
    };
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const leadId = await this.nextLeadId(client);
      await client.query(
        `INSERT INTO crm_leads (
           sqlite_lead_id, full_name, phone, email, status, source, channel, re_project_id,
           meta_json, created_at, updated_at, received_at, is_duplicate, write_source, synced_at
         ) VALUES ($1,$2,$3,$4,'moi',$5,$6,$7,$8::jsonb,$9::timestamptz,$9::timestamptz,$9::timestamptz,FALSE,'nest',NOW())`,
        [
          leadId,
          body.full_name.trim(),
          body.phone.trim(),
          body.email?.trim() ?? '',
          body.source?.trim() ?? 'manual',
          body.channel?.trim() ?? 'manual',
          body.re_project_id,
          JSON.stringify(meta),
          ts,
        ],
      );
      await client.query('COMMIT');
      const created = await this.getLeadForScope(leadId);
      if (!created) throw new Error('create failed');
      return created;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async isProjectStaff(projectId: number, staffId: number): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM crm_re_project_staff
       WHERE project_id = $1 AND staff_id = $2 AND left_at IS NULL LIMIT 1`,
      [projectId, staffId],
    );
    return Boolean(res.rows[0]);
  }
}
