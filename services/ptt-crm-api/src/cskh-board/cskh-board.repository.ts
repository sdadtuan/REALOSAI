import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { pgRowToV1 } from '../leads/lead-v1.mapper';
import { PgLeadRow } from '../leads/leads.types';
import { CskhBoardQuery, CskhBoardRow } from './cskh-board.types';

@Injectable()
export class CskhBoardRepository implements OnModuleDestroy {
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

  async listLeadCandidates(query: CskhBoardQuery): Promise<{ leads: PgLeadRow[]; total: number }> {
    const clauses = ['l.is_duplicate IS NOT TRUE'];
    const params: unknown[] = [];
    const spaMetaOnly = query.spa_meta_only !== false;
    const selectedTier = query.sla_tier && query.sla_tier !== 'all' ? query.sla_tier : null;

    if (spaMetaOnly) {
      clauses.push(`(
        lower(COALESCE(l.channel, '')) IN ('meta', 'facebook')
        OR lower(COALESCE(l.source, '')) IN ('meta', 'facebook')
        OR l.agency_client_id IS NOT NULL
      )`);
    }

    if (query.owner_id != null && Number.isFinite(query.owner_id)) {
      params.push(Number(query.owner_id));
      clauses.push(`l.owner_id = $${params.length}`);
    }
    if (query.status?.trim()) {
      params.push(query.status.trim());
      clauses.push(`l.status = $${params.length}`);
    } else if (!selectedTier && query.sla_filter && query.sla_filter !== 'all') {
      params.push('new', 'moi');
      clauses.push(`(lower(l.status) = $${params.length - 1} OR lower(l.status) = $${params.length})`);
    } else if (selectedTier) {
      clauses.push(`(
        lower(COALESCE(l.status, '')) NOT IN ('won', 'post_sale')
        OR COALESCE(l.received_at, l.created_at) >= NOW() - INTERVAL '48 hours'
      )`);
    }
    if (query.source?.trim()) {
      params.push(query.source.trim());
      clauses.push(`l.source = $${params.length}`);
    }
    if (query.channel?.trim()) {
      params.push(query.channel.trim().toLowerCase());
      clauses.push(`lower(l.channel) = $${params.length}`);
    }
    if (query.q?.trim()) {
      const like = `%${query.q.trim()}%`;
      params.push(like, like, like);
      const a = params.length - 2;
      const b = params.length - 1;
      const c = params.length;
      clauses.push(`(l.full_name ILIKE $${a} OR l.phone ILIKE $${b} OR l.email ILIKE $${c})`);
    }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const scanLimit = Math.min(Math.max(Number(query.limit ?? 50) * 8, 150), 800);

    const countResult = await this.db.query(`SELECT COUNT(*)::int AS c FROM crm_leads l${where}`, params);
    const total = Number(countResult.rows[0]?.c ?? 0);

    const listParams = [...params, scanLimit, 0];
    const listResult = await this.db.query(
      `SELECT l.sqlite_lead_id, l.full_name, l.phone, l.email, l.status, l.source,
              l.owner_id, l.is_duplicate, l.agency_client_id, l.channel,
              l.external_lead_id, l.campaign_id, l.received_at, l.created_at,
              COALESCE(l.care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              l.updated_at
       FROM crm_leads l
       ${where}
       ORDER BY COALESCE(l.received_at, l.created_at) DESC NULLS LAST, l.sqlite_lead_id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    return {
      leads: listResult.rows as PgLeadRow[],
      total,
    };
  }

  /** Spa Meta cohort — leads received on current ICT calendar day. */
  async countSpaMetaLeadsReceivedToday(): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS c
       FROM crm_leads l
       WHERE l.is_duplicate IS NOT TRUE
         AND (
           lower(COALESCE(l.channel, '')) IN ('meta', 'facebook')
           OR lower(COALESCE(l.source, '')) IN ('meta', 'facebook')
           OR l.agency_client_id IS NOT NULL
         )
         AND date_trunc(
           'day',
           COALESCE(l.received_at, l.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh'
         ) = date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  static toBoardRowBase(row: PgLeadRow & { care_stages_done_json?: string | null; updated_at?: Date | string | null }): Omit<
    CskhBoardRow,
    | 'first_call_at'
    | 'b2_completed_at'
    | 'closed_at'
    | 'sla_state'
    | 'sla_tier'
    | 'sla_tiers'
    | 'sla_minutes_elapsed'
    | 'sla_deadline_at'
    | 'next_follow_up_at'
    | 'owner_name'
  > & { care_stages_done_json: string | null; updated_at: string | null } {
    const lead = pgRowToV1(row);
    return {
      id: lead.id,
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      channel: lead.channel,
      owner_id: lead.owner_id,
      received_at: lead.received_at,
      created_at: lead.created_at,
      care_stages_done_json: row.care_stages_done_json ? String(row.care_stages_done_json) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    };
  }
}
