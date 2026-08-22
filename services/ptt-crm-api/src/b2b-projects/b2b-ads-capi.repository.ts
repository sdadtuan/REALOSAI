import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class B2bAdsCapiRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    const result = await this.db.query(`SELECT to_regclass('public.crm_b2b_ads_capi_log') AS reg`);
    return result.rows[0]?.reg != null;
  }

  async insertLog(input: {
    leadId: number;
    channel: string;
    campaignId?: string | null;
    hashedPhone?: string | null;
    status: string;
    error?: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_b2b_ads_capi_log (lead_id, channel, campaign_id, hashed_phone, status, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.leadId,
        input.channel,
        input.campaignId ?? null,
        input.hashedPhone ?? null,
        input.status,
        input.error ?? null,
      ],
    );
  }

  async loadLeadConversionContext(leadId: number): Promise<{
    phone: string | null;
    channel: string | null;
    campaignId: string | null;
  } | null> {
    const result = await this.db.query(
      `SELECT phone,
              COALESCE(meta_json->>'channel', meta_json->>'ingest_channel', channel, '') AS channel,
              COALESCE(
                NULLIF(meta_json->>'campaign_id', ''),
                NULLIF(meta_json->>'utm_campaign', ''),
                NULLIF(meta_json->'meta'->>'campaign_id', ''),
                ''
              ) AS campaign_id
       FROM crm_leads
       WHERE id = $1
       LIMIT 1`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      phone: row.phone != null ? String(row.phone) : null,
      channel: row.channel != null ? String(row.channel) : null,
      campaignId: row.campaign_id ? String(row.campaign_id) : null,
    };
  }
}
