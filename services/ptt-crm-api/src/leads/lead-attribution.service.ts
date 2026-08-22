import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { computeCplDelta } from '../meta-attribution.util';
import { LeadAttributionData } from './lead-attribution.types';
import {
  attributionPeriodDays,
  buildAdsHubLink,
  buildHubHref,
  computeCpl,
  normalizeAdsChannel,
  resolveCampaignId,
} from './lead-attribution.util';
import { LeadsRepository } from './leads.repository';
import { LeadV1 } from './leads.types';

@Injectable()
export class LeadAttributionService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly leads: LeadsRepository,
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
  }

  async getLeadAttribution(leadId: number): Promise<LeadAttributionData> {
    const lead = await this.leads.getLeadById(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
    }

    const campaignId = resolveCampaignId(lead, {});
    const channel = lead.channel || lead.source || null;
    const clientId = lead.client_id;
    const periodDays = attributionPeriodDays();

    if (!campaignId) {
      const adsLink = clientId ? buildAdsHubLink(channel, clientId, 'all') : { href: null, label: null };
      return {
        lead_id: lead.id,
        campaign_id: null,
        campaign_name: null,
        channel,
        client_id: clientId,
        hub_mapped: false,
        cpl_vnd: null,
        target_cpl_vnd: null,
        cpl_vs_target_pct: null,
        cpl_over_target: false,
        period_days: periodDays,
        hub_href: '/crm/hub',
        ads_hub_href: adsLink.href,
        ads_hub_label: adsLink.label,
      };
    }

    const perf = await this.loadCampaignPerformance({ clientId, campaignId, channel });
    const cplDelta = computeCplDelta(perf.cpl_vnd, perf.target_cpl_vnd);
    const adsLink = buildAdsHubLink(channel, clientId, campaignId);

    return {
      lead_id: lead.id,
      campaign_id: campaignId,
      campaign_name: perf.campaign_name ?? campaignId,
      channel,
      client_id: clientId,
      hub_mapped: perf.hub_mapped,
      cpl_vnd: perf.cpl_vnd,
      target_cpl_vnd: perf.target_cpl_vnd,
      cpl_vs_target_pct: cplDelta.deltaPct,
      cpl_over_target: cplDelta.overTarget,
      period_days: periodDays,
      hub_href: buildHubHref(campaignId),
      ads_hub_href: adsLink.href,
      ads_hub_label: adsLink.label,
    };
  }

  private async loadCampaignPerformance(input: {
    clientId: string | null;
    campaignId: string;
    channel: string | null;
  }): Promise<{
    campaign_name: string | null;
    target_cpl_vnd: number | null;
    cpl_vnd: number | null;
    hub_mapped: boolean;
  }> {
    const adsChannel = normalizeAdsChannel(input.channel) || 'meta';
    const periodDays = attributionPeriodDays();

    try {
      const params: unknown[] = [input.campaignId, adsChannel, periodDays];
      let clientClause = '';
      if (input.clientId) {
        clientClause = 'AND hcm.client_id = $4::uuid';
        params.push(input.clientId);
      }

      const result = await this.db.query(
        `SELECT hcm.external_campaign_name,
                hcm.target_cpl_vnd,
                hcm.active,
                COALESCE(SUM(dp.spend), 0)::float AS spend,
                COALESCE(SUM(dp.leads_crm), 0)::float AS leads_crm
         FROM hub_campaign_map hcm
         LEFT JOIN daily_performance dp
           ON dp.hub_campaign_map_id = hcm.id
          AND dp.performance_date >= (CURRENT_DATE - ($3::int * INTERVAL '1 day'))
         WHERE hcm.external_campaign_id = $1
           AND hcm.channel = $2
           ${clientClause}
         GROUP BY hcm.id, hcm.external_campaign_name, hcm.target_cpl_vnd, hcm.active
         ORDER BY hcm.active DESC, SUM(dp.spend) DESC NULLS LAST
         LIMIT 1`,
        params,
      );

      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        return {
          campaign_name: null,
          target_cpl_vnd: null,
          cpl_vnd: null,
          hub_mapped: false,
        };
      }

      const spend = Number(row.spend ?? 0);
      const leads = Number(row.leads_crm ?? 0);
      const target =
        row.target_cpl_vnd != null && Number.isFinite(Number(row.target_cpl_vnd))
          ? Math.trunc(Number(row.target_cpl_vnd))
          : null;

      return {
        campaign_name: row.external_campaign_name ? String(row.external_campaign_name) : null,
        target_cpl_vnd: target,
        cpl_vnd: computeCpl(spend, leads),
        hub_mapped: Boolean(row.active ?? true),
      };
    } catch {
      return {
        campaign_name: null,
        target_cpl_vnd: null,
        cpl_vnd: null,
        hub_mapped: false,
      };
    }
  }

  newRequestId(): string {
    return randomUUID();
  }
}
