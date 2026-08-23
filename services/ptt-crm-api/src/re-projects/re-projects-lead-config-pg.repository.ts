import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  assertCanEnableLeadForms,
  isMetaAdAccountMapped,
  normalizeMetaAdAccountId,
} from './marketing-config.util';
import type { ReProjectLeadConfigRow, SaveProjectLeadConfigBody } from './re-projects.types';

function facebookWebhookBase(): string {
  return (
    process.env.CRM_FACEBOOK_WEBHOOK_URL ??
    process.env.FACEBOOK_WEBHOOK_URL ??
    'https://pttads.vn/api/crm/integration/webhooks/facebook'
  )
    .trim()
    .replace(/\/+$/, '');
}

function zaloWebhookBase(): string {
  return (
    process.env.CRM_ZALO_WEBHOOK_URL ??
    process.env.ZALO_WEBHOOK_URL ??
    'https://pttads.vn/api/crm/integration/webhooks/zalo'
  )
    .trim()
    .replace(/\/+$/, '');
}

function defaultWebhookSlug(projectId: number): string {
  return `p${projectId}-${randomBytes(4).toString('hex').slice(0, 8)}`;
}

@Injectable()
export class ReProjectsLeadConfigPgRepository implements OnModuleDestroy {
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

  private webhookUrl(slug: string): string {
    return `${facebookWebhookBase()}/${slug}`;
  }

  private zaloWebhookUrl(slug: string): string {
    return `${zaloWebhookBase()}/${slug}`;
  }

  private async loadForms(projectId: number): Promise<Array<Record<string, unknown>>> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_facebook_forms WHERE project_id = $1 ORDER BY form_name`,
      [projectId],
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      project_id: Number(r.project_id),
      page_id: String(r.page_id ?? ''),
      form_id: String(r.form_id ?? ''),
      form_name: String(r.form_name ?? ''),
      active: Boolean(r.active),
    }));
  }

  private async loadZaloCampaigns(projectId: number): Promise<Array<Record<string, unknown>>> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_zalo_campaigns WHERE project_id = $1 ORDER BY campaign_name`,
      [projectId],
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      project_id: Number(r.project_id),
      oa_id: String(r.oa_id ?? ''),
      campaign_id: String(r.campaign_id ?? ''),
      campaign_name: String(r.campaign_name ?? ''),
      active: Boolean(r.active),
    }));
  }

  private async loadWebsiteRoutes(projectId: number): Promise<Array<Record<string, unknown>>> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_website_routes WHERE project_id = $1 ORDER BY route_name`,
      [projectId],
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      project_id: Number(r.project_id),
      route_key: String(r.route_key ?? ''),
      route_name: String(r.route_name ?? ''),
      route_type: String(r.route_type ?? 'utm'),
      active: Boolean(r.active),
    }));
  }

  private rowToDict(row: Record<string, unknown> | undefined, projectId: number): ReProjectLeadConfigRow {
    if (!row) {
      const slug = defaultWebhookSlug(projectId);
      return {
        project_id: projectId,
        enabled: true,
        webhook_slug: slug,
        webhook_verify_token: '',
        webhook_url: this.webhookUrl(slug),
        zalo_webhook_url: this.zaloWebhookUrl(slug),
        facebook_page_id: '',
        meta_ad_account_id: '',
        meta_ad_account_mapped: false,
        zalo_oa_id: '',
        auto_assign: true,
        webhook_enabled: true,
        forms: [],
        zalo_campaigns: [],
        website_routes: [],
        updated_at: '',
        updated_by: '',
      };
    }
    const slug = String(row.webhook_slug ?? '').trim() || defaultWebhookSlug(projectId);
    const metaAdAccountId = normalizeMetaAdAccountId(row.meta_ad_account_id);
    return {
      project_id: Number(row.project_id),
      enabled: Boolean(row.enabled ?? true),
      webhook_slug: slug,
      webhook_verify_token: String(row.webhook_verify_token ?? ''),
      webhook_url: this.webhookUrl(slug),
      zalo_webhook_url: this.zaloWebhookUrl(slug),
      facebook_page_id: String(row.facebook_page_id ?? ''),
      meta_ad_account_id: metaAdAccountId,
      meta_ad_account_mapped: isMetaAdAccountMapped(metaAdAccountId),
      zalo_oa_id: String(row.zalo_oa_id ?? ''),
      auto_assign: Boolean(row.auto_assign ?? true),
      webhook_enabled: Boolean(row.webhook_enabled ?? true),
      forms: [],
      zalo_campaigns: [],
      website_routes: [],
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
      updated_by: String(row.updated_by ?? ''),
    };
  }

  async resolveProjectBySlug(slug: string): Promise<number | null> {
    const normalized = String(slug ?? '').trim().toLowerCase();
    if (!normalized) return null;
    const res = await this.db.query(
      `SELECT project_id FROM crm_re_project_lead_config
       WHERE lower(trim(webhook_slug)) = $1 AND enabled = TRUE
       LIMIT 1`,
      [normalized],
    );
    return res.rows[0]?.project_id != null ? Number(res.rows[0].project_id) : null;
  }

  async hasMetaAdMappedForTenant(projectIds: number[]): Promise<boolean> {
    if (projectIds.length === 0) return false;
    const res = await this.db.query(
      `SELECT 1 AS ok FROM crm_re_project_lead_config
       WHERE project_id = ANY($1::int[])
         AND trim(COALESCE(meta_ad_account_id, '')) <> ''
       LIMIT 1`,
      [projectIds],
    );
    return Boolean(res.rows[0]);
  }

  async getProjectLeadConfig(projectId: number): Promise<ReProjectLeadConfigRow> {
    const proj = await this.db.query(`SELECT 1 FROM crm_re_projects WHERE id = $1`, [projectId]);
    if (!proj.rows[0]) throw new Error('Không tìm thấy dự án.');
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_lead_config WHERE project_id = $1`,
      [projectId],
    );
    const out = this.rowToDict(res.rows[0] as Record<string, unknown> | undefined, projectId);
    out.forms = await this.loadForms(projectId);
    out.zalo_campaigns = await this.loadZaloCampaigns(projectId);
    out.website_routes = await this.loadWebsiteRoutes(projectId);
    return out;
  }

  async saveProjectLeadConfig(
    projectId: number,
    payload: SaveProjectLeadConfigBody,
    updatedBy = '',
  ): Promise<ReProjectLeadConfigRow> {
    const proj = await this.db.query(`SELECT 1 FROM crm_re_projects WHERE id = $1`, [projectId]);
    if (!proj.rows[0]) throw new Error('Không tìm thấy dự án.');
    const existingRes = await this.db.query(
      `SELECT * FROM crm_re_project_lead_config WHERE project_id = $1`,
      [projectId],
    );
    const existing = existingRes.rows[0] as Record<string, unknown> | undefined;
    let slug = String(existing?.webhook_slug ?? '').trim();
    if (!slug) slug = defaultWebhookSlug(projectId);
    let verify = String(existing?.webhook_verify_token ?? '').trim();
    if (!verify) verify = randomBytes(12).toString('base64url');
    const enabled = !(payload.enabled === false || payload.enabled === 0);
    const webhookEnabled = !(payload.webhook_enabled === false || payload.webhook_enabled === 0);
    const autoAssign = !(payload.auto_assign === false || payload.auto_assign === 0);
    const pageId = String(payload.facebook_page_id ?? existing?.facebook_page_id ?? '').trim();
    const metaAdAccountId = normalizeMetaAdAccountId(
      payload.meta_ad_account_id ?? existing?.meta_ad_account_id ?? '',
    );
    const zaloOaId = String(payload.zalo_oa_id ?? existing?.zalo_oa_id ?? '').trim();
    assertCanEnableLeadForms({
      metaAdAccountId,
      webhookEnabled,
      forms: payload.forms,
    });
    if (payload.webhook_slug != null) {
      const rawSlug = String(payload.webhook_slug ?? '').trim().toLowerCase();
      if (rawSlug) {
        const dup = await this.db.query(
          `SELECT project_id FROM crm_re_project_lead_config
           WHERE lower(trim(webhook_slug)) = $1 AND project_id != $2 LIMIT 1`,
          [rawSlug, projectId],
        );
        if (dup.rows[0]) throw new Error(`Webhook slug «${rawSlug}» đã dùng cho dự án khác.`);
        slug = rawSlug;
      }
    }
    if (payload.regenerate_verify_token) verify = randomBytes(12).toString('base64url');
    await this.db.query(
      `INSERT INTO crm_re_project_lead_config (
         project_id, enabled, webhook_slug, webhook_verify_token, facebook_page_id,
         meta_ad_account_id, zalo_oa_id, auto_assign, webhook_enabled, updated_at, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10)
       ON CONFLICT (project_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         webhook_slug = EXCLUDED.webhook_slug,
         webhook_verify_token = EXCLUDED.webhook_verify_token,
         facebook_page_id = EXCLUDED.facebook_page_id,
         meta_ad_account_id = EXCLUDED.meta_ad_account_id,
         zalo_oa_id = EXCLUDED.zalo_oa_id,
         auto_assign = EXCLUDED.auto_assign,
         webhook_enabled = EXCLUDED.webhook_enabled,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        projectId,
        enabled,
        slug,
        verify,
        pageId,
        metaAdAccountId,
        zaloOaId,
        autoAssign,
        webhookEnabled,
        String(updatedBy).slice(0, 120),
      ],
    );
    if (Array.isArray(payload.forms)) {
      for (const raw of payload.forms) {
        if (!raw || typeof raw !== 'object') continue;
        const formId = String((raw as Record<string, unknown>).form_id ?? '').trim();
        if (!formId) continue;
        const formName = String((raw as Record<string, unknown>).form_name ?? '').trim();
        const formPageId = String((raw as Record<string, unknown>).page_id ?? pageId).trim();
        const active = (raw as Record<string, unknown>).active !== false;
        await this.db.query(
          `INSERT INTO crm_re_project_facebook_forms (project_id, page_id, form_id, form_name, active, updated_at)
           VALUES ($1,$2,$3,$4,$5,NOW())
           ON CONFLICT (form_id) DO UPDATE SET
             project_id = EXCLUDED.project_id,
             page_id = EXCLUDED.page_id,
             form_name = EXCLUDED.form_name,
             active = EXCLUDED.active,
             updated_at = NOW()`,
          [projectId, formPageId, formId, formName, active],
        );
      }
    }
    if (Array.isArray(payload.zalo_campaigns)) {
      for (const raw of payload.zalo_campaigns) {
        if (!raw || typeof raw !== 'object') continue;
        const campaignId = String((raw as Record<string, unknown>).campaign_id ?? '').trim();
        if (!campaignId) continue;
        const campaignName = String((raw as Record<string, unknown>).campaign_name ?? '').trim();
        const oaId = String((raw as Record<string, unknown>).oa_id ?? zaloOaId).trim();
        const active = (raw as Record<string, unknown>).active !== false;
        await this.db.query(
          `INSERT INTO crm_re_project_zalo_campaigns (project_id, oa_id, campaign_id, campaign_name, active, updated_at)
           VALUES ($1,$2,$3,$4,$5,NOW())
           ON CONFLICT (campaign_id) DO UPDATE SET
             project_id = EXCLUDED.project_id,
             oa_id = EXCLUDED.oa_id,
             campaign_name = EXCLUDED.campaign_name,
             active = EXCLUDED.active,
             updated_at = NOW()`,
          [projectId, oaId, campaignId, campaignName, active],
        );
      }
    }
    if (Array.isArray(payload.website_routes)) {
      for (const raw of payload.website_routes) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const routeKey = String(item.route_key ?? item.utm_campaign ?? item.campaign_code ?? '').trim();
        if (!routeKey) continue;
        const routeName = String(item.route_name ?? item.route_label ?? '').trim();
        const routeType = String(item.route_type ?? 'utm').trim().toLowerCase() || 'utm';
        const active = item.active !== false;
        await this.db.query(
          `INSERT INTO crm_re_project_website_routes (project_id, route_key, route_name, route_type, active, updated_at)
           VALUES ($1,$2,$3,$4,$5,NOW())
           ON CONFLICT (route_key) DO UPDATE SET
             project_id = EXCLUDED.project_id,
             route_name = EXCLUDED.route_name,
             route_type = EXCLUDED.route_type,
             active = EXCLUDED.active,
             updated_at = NOW()`,
          [projectId, routeKey, routeName, routeType, active],
        );
      }
    }
    return this.getProjectLeadConfig(projectId);
  }
}
