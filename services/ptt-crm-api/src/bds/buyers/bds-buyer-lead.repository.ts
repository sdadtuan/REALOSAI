import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { isBdsPgOltp } from '../inventory/bds-dual-write.util';
import { AppConfigService } from '../../config/app-config.service';
import { assertSqliteAllowed } from '../../common/sqlite-guard.util';
import { catalogTs } from '../../catalog/catalog-slug.util';
import { BdsBuyerLeadPgRepository } from './bds-buyer-lead-pg.repository';
import type { BuyerLeadRow, CreateBuyerLeadBody } from './bds-buyer.types';
import { normalizePhoneE164 } from './bds-buyer.util';

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

@Injectable()
export class BdsBuyerLeadRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly pg?: BdsBuyerLeadPgRepository,
  ) {}

  private usePg(): boolean {
    return isBdsPgOltp() && this.pg != null;
  }

  private get database(): DatabaseSync {
    assertSqliteAllowed();
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
    }
    return this.db;
  }

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private mapLead(row: Record<string, unknown>): BuyerLeadRow {
    const meta = parseMeta(row.meta_json != null ? String(row.meta_json) : null);
    return {
      id: Number(row.id),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      status: String(row.status ?? 'moi'),
      re_project_id: row.re_project_id != null ? Number(row.re_project_id) : null,
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
      created_at: row.created_at != null ? String(row.created_at) : null,
      received_at: row.received_at != null ? String(row.received_at) : null,
    };
  }

  async findReBuyerByPhoneProject(input: {
    phone: string;
    reProjectId: number;
    tenantId: string;
  }): Promise<{ lead_id: number } | null> {
    if (this.usePg()) return this.pg!.findReBuyerByPhoneProject(input);
    const phone = normalizePhoneE164(input.phone);
    const rows = this.database
      .prepare(
        `SELECT id, phone, meta_json FROM crm_leads
         WHERE re_project_id = ?
           AND COALESCE(is_duplicate, 0) = 0
         ORDER BY id ASC
         LIMIT 200`,
      )
      .all(input.reProjectId) as Array<{ id: number; phone: string; meta_json: string | null }>;

    for (const row of rows) {
      const meta = parseMeta(row.meta_json);
      if (String(meta.bds_tenant_id ?? '') !== input.tenantId) continue;
      if (normalizePhoneE164(row.phone) !== phone) continue;
      if (String(meta.lead_flow_kind ?? '') !== 're_buyer') continue;
      return { lead_id: Number(row.id) };
    }
    return null;
  }

  async patchLeadMeta(leadId: number, patch: Record<string, unknown>): Promise<void> {
    if (this.usePg()) return this.pg!.patchLeadMeta(leadId, patch);
    const row = this.database
      .prepare(`SELECT meta_json FROM crm_leads WHERE id = ?`)
      .get(leadId) as { meta_json: string | null } | undefined;
    if (!row) return;
    const meta = { ...parseMeta(row.meta_json), ...patch };
    const ts = catalogTs();
    this.database
      .prepare(`UPDATE crm_leads SET meta_json = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(meta), ts, leadId);
  }

  async setLeadStatus(leadId: number, status: string): Promise<void> {
    if (this.usePg()) return this.pg!.setLeadStatus(leadId, status);
    const ts = catalogTs();
    this.database
      .prepare(`UPDATE crm_leads SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, ts, leadId);
  }

  async getLeadForScope(leadId: number): Promise<BuyerLeadRow | null> {
    if (this.usePg()) return this.pg!.getLeadForScope(leadId);
    const row = this.database
      .prepare(
        `SELECT id, full_name, phone, email, status, re_project_id, owner_id, meta_json, created_at, received_at
         FROM crm_leads WHERE id = ? LIMIT 1`,
      )
      .get(leadId) as Record<string, unknown> | undefined;
    return row ? this.mapLead(row) : null;
  }

  async listByProject(projectId: number, tenantId?: string): Promise<BuyerLeadRow[]> {
    if (this.usePg()) return this.pg!.listByProject(projectId, tenantId);
    const rows = this.database
      .prepare(
        `SELECT id, full_name, phone, email, status, re_project_id, owner_id, meta_json, created_at, received_at
         FROM crm_leads
         WHERE re_project_id = ?
         ORDER BY id DESC
         LIMIT 500`,
      )
      .all(projectId) as Record<string, unknown>[];

    return rows
      .map((row) => this.mapLead(row))
      .filter((row) => String(row.meta_json.lead_flow_kind ?? '') === 're_buyer')
      .filter((row) => !tenantId || row.tenant_id === tenantId);
  }

  async createLead(
    body: CreateBuyerLeadBody,
    tenantId: string,
  ): Promise<BuyerLeadRow> {
    if (this.usePg()) return this.pg!.createLead(body, tenantId);
    const ts = catalogTs();
    const meta = {
      lead_flow_kind: 're_buyer',
      re_project_id: body.re_project_id,
      bds_tenant_id: tenantId,
      need_json: body.need_json ?? {},
      ...(body.re_product_id != null ? { re_product_id: body.re_product_id } : {}),
    };
    const result = this.database
      .prepare(
        `INSERT INTO crm_leads (
           full_name, phone, email, status, source, channel, re_project_id, meta_json,
           created_at, updated_at, received_at, is_duplicate
         ) VALUES (?, ?, ?, 'moi', ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        body.full_name.trim(),
        body.phone.trim(),
        body.email?.trim() ?? '',
        body.source?.trim() ?? 'manual',
        body.channel?.trim() ?? 'manual',
        body.re_project_id,
        JSON.stringify(meta),
        ts,
        ts,
        ts,
      );
    const leadId = Number(result.lastInsertRowid);
    const created = await this.getLeadForScope(leadId);
    if (!created) throw new Error('create failed');
    return created;
  }

  async isProjectStaff(projectId: number, staffId: number): Promise<boolean> {
    if (this.usePg()) return this.pg!.isProjectStaff(projectId, staffId);
    const row = this.database
      .prepare(
        `SELECT 1 FROM crm_re_project_staff
         WHERE project_id = ? AND staff_id = ? AND COALESCE(left_at, '') = ''
         LIMIT 1`,
      )
      .get(projectId, staffId) as { 1: number } | undefined;
    return Boolean(row);
  }
}
