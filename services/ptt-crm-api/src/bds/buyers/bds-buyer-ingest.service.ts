import { Injectable } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../../config/app-config.service';
import { Pool } from 'pg';
import { isBdsBuyerEnabled } from '../bds.flags';
import type { PreparedBuyerLead } from './bds-buyer.types';
import type { NormalizedLeadPayload } from '../../webhooks/webhook-lead.types';

export type BuyerIngestPrepareResult = {
  handled: boolean;
  toEnqueue: PreparedBuyerLead[];
  unmatchedCount: number;
};

@Injectable()
export class BdsBuyerIngestService {
  private sqlite: DatabaseSync | null = null;
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  isActive(): boolean {
    return isBdsBuyerEnabled();
  }

  private get database(): DatabaseSync {
    if (!this.sqlite) {
      this.sqlite = new DatabaseSync(this.config.sqlitePath);
      this.sqlite.exec('PRAGMA foreign_keys = ON');
    }
    return this.sqlite;
  }

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async resolveProjectBySlug(
    slug: string,
  ): Promise<{ projectId: number; tenantId: string } | null> {
    const normalized = String(slug ?? '').trim().toLowerCase();
    if (!normalized) return null;

    const cfg = this.database
      .prepare(
        `SELECT project_id FROM crm_re_project_lead_config
         WHERE LOWER(webhook_slug) = ? AND COALESCE(enabled, 1) = 1
         LIMIT 1`,
      )
      .get(normalized) as { project_id: number } | undefined;
    if (!cfg?.project_id) return null;

    const projectId = Number(cfg.project_id);
    const pg = await this.db.query(
      `SELECT tenant_id FROM crm_re_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    const tenantId = pg.rows[0]?.tenant_id != null ? String(pg.rows[0].tenant_id) : '';
    if (!tenantId) return null;
    return { projectId, tenantId };
  }

  async prepareWebhookLeads(input: {
    channel: string;
    projectSlug?: string;
    leads: NormalizedLeadPayload[];
  }): Promise<BuyerIngestPrepareResult> {
    if (!this.isActive() || !input.projectSlug?.trim()) {
      return { handled: false, toEnqueue: [], unmatchedCount: 0 };
    }

    const resolved = await this.resolveProjectBySlug(input.projectSlug);
    if (!resolved) {
      return { handled: false, toEnqueue: [], unmatchedCount: 0 };
    }

    const toEnqueue: PreparedBuyerLead[] = input.leads.map((lead) => ({
      ...lead,
      client_id: '',
      b2b_project_id: null,
      owner_company_id: null,
      lead_flow_kind: 're_buyer',
      meta: {
        ...(lead as PreparedBuyerLead).meta,
        lead_flow_kind: 're_buyer',
        re_project_id: resolved.projectId,
        bds_tenant_id: resolved.tenantId,
        ingest_channel: input.channel,
      },
    }));

    return {
      handled: true,
      toEnqueue,
      unmatchedCount: 0,
    };
  }
}
