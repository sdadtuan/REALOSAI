import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { LeadIngestRulesRepository } from '../leads/ingest/lead-ingest-rules.repository';
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPES,
  CreateLeadActivityBody,
  LeadActivityRow,
  LeadAssignmentLogRow,
  LeadStatusLogRow,
} from './crm-leads-legacy.types';

@Injectable()
export class CrmLeadsPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

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
  }

  async staffExists(staffId: number): Promise<boolean> {
    return this.ingestRules.staffExists(staffId);
  }

  async getLeadOwnerId(leadId: number): Promise<number | null> {
    const result = await this.db.query(
      `SELECT owner_id FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const ownerId = result.rows[0]?.owner_id;
    return ownerId != null ? Number(ownerId) : null;
  }

  async getLeadStatus(leadId: number): Promise<string> {
    const result = await this.db.query(
      `SELECT status FROM crm_leads WHERE sqlite_lead_id = $1 LIMIT 1`,
      [leadId],
    );
    return String(result.rows[0]?.status ?? 'new');
  }

  async listActivities(leadId: number, limit = 100): Promise<LeadActivityRow[]> {
    const lim = Math.max(1, Math.min(limit, 500));
    const result = await this.db.query(
      `SELECT a.* FROM crm_lead_activities a
       WHERE a.lead_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [leadId, lim],
    );
    const rows = result.rows as Array<Record<string, unknown>>;
    const out: LeadActivityRow[] = [];
    for (const row of rows) {
      const userId = row.user_id != null ? Number(row.user_id) : null;
      const userName = userId ? await this.ingestRules.staffName(userId) : '';
      out.push(this.mapActivity(row, userName));
    }
    return out;
  }

  async createActivity(
    leadId: number,
    body: CreateLeadActivityBody,
    actor: string,
    userId: number | null,
  ): Promise<LeadActivityRow> {
    let at = String(body.activity_type ?? 'note')
      .trim()
      .toLowerCase();
    if (!ACTIVITY_TYPES.includes(at as (typeof ACTIVITY_TYPES)[number])) {
      at = 'note';
    }
    const ts = catalogTs();
    const statusSnap = await this.getLeadStatus(leadId);
    const insert = await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, user_id, activity_type, content, result,
         next_action, next_action_at, created_at, created_by, lead_status_at_log
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10)
       RETURNING *`,
      [
        leadId,
        userId,
        at,
        String(body.content ?? '').slice(0, 8000),
        String(body.result ?? '').slice(0, 2000),
        String(body.next_action ?? '').slice(0, 500),
        body.next_action_at ? String(body.next_action_at).slice(0, 40) : null,
        ts,
        actor.slice(0, 120),
        statusSnap,
      ],
    );
    await this.db.query(
      `UPDATE crm_leads SET updated_at = NOW(), updated_by = $2 WHERE sqlite_lead_id = $1`,
      [leadId, actor.slice(0, 120)],
    );
    const row = insert.rows[0] as Record<string, unknown>;
    const userName = userId ? await this.ingestRules.staffName(userId) : '';
    return this.mapActivity(row, userName);
  }

  async logAssignment(
    leadId: number,
    fromUserId: number | null,
    toUserId: number | null,
    reason: string,
    actor: string,
    ts: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_lead_assignment_log
         (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
      [
        leadId,
        fromUserId,
        toUserId,
        reason.slice(0, 500),
        actor.slice(0, 120),
        ts,
      ],
    );
  }

  async listStatusLogs(_leadId: number, _limit = 100): Promise<LeadStatusLogRow[]> {
    return [];
  }

  async firstCallAtByLeadIds(leadIds: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (!leadIds.length) return out;
    const result = await this.db.query(
      `SELECT lead_id, MIN(created_at)::text AS first_call_at
       FROM crm_lead_activities
       WHERE lead_id = ANY($1::bigint[]) AND activity_type = 'call'
       GROUP BY lead_id`,
      [leadIds],
    );
    for (const row of result.rows as Array<{ lead_id: string; first_call_at: string }>) {
      if (row.first_call_at) out.set(Number(row.lead_id), String(row.first_call_at));
    }
    return out;
  }

  async nextFollowUpByLeadIds(leadIds: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (!leadIds.length) return out;
    const result = await this.db.query(
      `SELECT DISTINCT ON (lead_id) lead_id, next_action_at::text AS next_action_at
       FROM crm_lead_activities
       WHERE lead_id = ANY($1::bigint[])
         AND next_action_at IS NOT NULL
       ORDER BY lead_id, created_at DESC`,
      [leadIds],
    );
    for (const row of result.rows as Array<{ lead_id: string; next_action_at: string }>) {
      if (row.next_action_at) out.set(Number(row.lead_id), String(row.next_action_at));
    }
    return out;
  }

  async staffNamesByIds(staffIds: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    const uniq = [...new Set(staffIds.filter((id) => id > 0))];
    for (const id of uniq) {
      const name = await this.ingestRules.staffName(id);
      if (name) out.set(id, name);
    }
    return out;
  }

  async listAssignmentLogs(leadId: number, limit = 100): Promise<LeadAssignmentLogRow[]> {
    const lim = Math.max(1, Math.min(limit, 200));
    const result = await this.db.query(
      `SELECT id, sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at
       FROM crm_lead_assignment_log
       WHERE sqlite_lead_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [leadId, lim],
    );
    const rows = result.rows as Array<Record<string, unknown>>;
    const out: LeadAssignmentLogRow[] = [];
    for (const row of rows) {
      const fromId = row.from_owner_id != null ? Number(row.from_owner_id) : null;
      const toId = row.to_owner_id != null ? Number(row.to_owner_id) : null;
      out.push({
        id: Number(row.id),
        lead_id: Number(row.sqlite_lead_id),
        from_user_id: fromId,
        from_name: fromId ? await this.ingestRules.staffName(fromId) : '—',
        to_user_id: toId,
        to_name: toId ? await this.ingestRules.staffName(toId) : '—',
        reason: String(row.reason ?? ''),
        created_by: String(row.assigned_by ?? ''),
        created_at: String(row.created_at ?? ''),
      });
    }
    return out;
  }

  private mapActivity(d: Record<string, unknown>, userName: string): LeadActivityRow {
    const at = String(d.activity_type ?? 'note');
    return {
      id: Number(d.id),
      lead_id: Number(d.lead_id),
      user_id: d.user_id != null ? Number(d.user_id) : null,
      user_name: userName,
      activity_type: at,
      activity_type_label: ACTIVITY_TYPE_LABELS[at] ?? at,
      content: String(d.content ?? ''),
      result: String(d.result ?? ''),
      next_action: String(d.next_action ?? ''),
      next_action_at: String(d.next_action_at ?? ''),
      created_at: String(d.created_at ?? ''),
      created_by: String(d.created_by ?? ''),
    };
  }
}
