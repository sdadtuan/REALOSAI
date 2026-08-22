import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  AccessReviewCampaign,
  AccessReviewCampaignStatus,
  AccessReviewItem,
  AccessReviewItemDecision,
  AccessReviewScopeType,
  CreateAccessReviewCampaignBody,
  PatchAccessReviewCampaignBody,
} from './admin-governance.types';

function mapCampaign(row: Record<string, unknown>, counts?: AccessReviewCampaign['item_counts']): AccessReviewCampaign {
  return {
    id: String(row.id),
    title: String(row.title),
    quarter: String(row.quarter),
    status: String(row.status) as AccessReviewCampaignStatus,
    scope_type: String(row.scope_type) as AccessReviewScopeType,
    scope_ref: row.scope_ref != null ? String(row.scope_ref) : null,
    due_at: String(row.due_at),
    owner_email: String(row.owner_email),
    launched_at: row.launched_at ? String(row.launched_at) : null,
    closed_at: row.closed_at ? String(row.closed_at) : null,
    item_counts: counts ?? { pending: 0, certified: 0, revoke: 0, total: 0 },
    created_at: String(row.created_at),
  };
}

function mapItem(row: Record<string, unknown>): AccessReviewItem {
  const teamRaw = row.team_ids;
  let teamIds: number[] = [];
  if (Array.isArray(teamRaw)) {
    teamIds = teamRaw.map(Number).filter((n) => n > 0);
  } else if (typeof teamRaw === 'string') {
    try {
      teamIds = (JSON.parse(teamRaw) as unknown[]).map(Number).filter((n) => n > 0);
    } catch {
      teamIds = [];
    }
  }
  let snapshot: Record<string, unknown> = {};
  const snapRaw = row.snapshot_json;
  if (snapRaw && typeof snapRaw === 'object') snapshot = snapRaw as Record<string, unknown>;
  else if (typeof snapRaw === 'string') {
    try {
      snapshot = JSON.parse(snapRaw) as Record<string, unknown>;
    } catch {
      snapshot = {};
    }
  }
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    user_id: String(row.user_id),
    user_email: String(row.user_email),
    user_display_name: String(row.user_display_name ?? ''),
    position_code: row.position_code ? String(row.position_code) : null,
    team_ids: teamIds,
    snapshot_json: snapshot,
    decision: String(row.decision) as AccessReviewItemDecision,
    certifier_email: row.certifier_email ? String(row.certifier_email) : null,
    certifier_note: row.certifier_note ? String(row.certifier_note) : null,
    decided_at: row.decided_at ? String(row.decided_at) : null,
  };
}

@Injectable()
export class AccessReviewCampaignRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private memoryCampaigns: AccessReviewCampaign[] = [];
  private memoryItems: AccessReviewItem[] = [];

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

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM admin_access_review_campaigns LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private async loadCounts(campaignId: string): Promise<AccessReviewCampaign['item_counts']> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query<{ decision: string; n: string }>(
        `SELECT decision, COUNT(*)::text AS n
         FROM admin_access_review_items
         WHERE campaign_id = $1::uuid
         GROUP BY decision`,
        [campaignId],
      );
      const counts = { pending: 0, certified: 0, revoke: 0, total: 0 };
      for (const row of result.rows) {
        const n = Number(row.n);
        counts.total += n;
        if (row.decision === 'pending') counts.pending = n;
        if (row.decision === 'certified') counts.certified = n;
        if (row.decision === 'revoke_requested') counts.revoke = n;
      }
      return counts;
    }
    const items = this.memoryItems.filter((i) => i.campaign_id === campaignId);
    return {
      total: items.length,
      pending: items.filter((i) => i.decision === 'pending').length,
      certified: items.filter((i) => i.decision === 'certified').length,
      revoke: items.filter((i) => i.decision === 'revoke_requested').length,
    };
  }

  async create(body: CreateAccessReviewCampaignBody, ownerEmail: string): Promise<AccessReviewCampaign> {
    const title = String(body.title ?? '').trim();
    const quarter = String(body.quarter ?? currentQuarter()).trim();
    const scopeType = (body.scope_type ?? 'all') as AccessReviewScopeType;
    const scopeRef = body.scope_ref != null ? String(body.scope_ref).trim() : null;
    const dueAt = body.due_at ?? defaultDueAt();
    const owner = String(body.owner_email ?? ownerEmail).trim().toLowerCase();

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO admin_access_review_campaigns
           (title, quarter, status, scope_type, scope_ref, due_at, owner_email)
         VALUES ($1, $2, 'draft', $3, $4, $5::timestamptz, $6)
         RETURNING id::text, title, quarter, status, scope_type, scope_ref, due_at::text,
                   owner_email, launched_at::text, closed_at::text, created_at::text`,
        [title, quarter, scopeType, scopeRef, dueAt, owner],
      );
      return mapCampaign(result.rows[0] as Record<string, unknown>);
    }

    const campaign = mapCampaign({
      id: `mem-${Date.now()}`,
      title,
      quarter,
      status: 'draft',
      scope_type: scopeType,
      scope_ref: scopeRef,
      due_at: dueAt,
      owner_email: owner,
      launched_at: null,
      closed_at: null,
      created_at: new Date().toISOString(),
    });
    this.memoryCampaigns.unshift(campaign);
    return campaign;
  }

  async list(status?: AccessReviewCampaignStatus): Promise<AccessReviewCampaign[]> {
    if (await this.ensurePgReady()) {
      const params: unknown[] = [];
      let where = '';
      if (status) {
        where = 'WHERE status = $1';
        params.push(status);
      }
      const result = await this.db.query(
        `SELECT id::text, title, quarter, status, scope_type, scope_ref, due_at::text,
                owner_email, launched_at::text, closed_at::text, created_at::text
         FROM admin_access_review_campaigns
         ${where}
         ORDER BY created_at DESC
         LIMIT 100`,
        params,
      );
      const out: AccessReviewCampaign[] = [];
      for (const row of result.rows) {
        const c = mapCampaign(row as Record<string, unknown>);
        c.item_counts = await this.loadCounts(c.id);
        out.push(c);
      }
      return out;
    }
    return this.memoryCampaigns.filter((c) => !status || c.status === status);
  }

  async getById(id: string): Promise<AccessReviewCampaign | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, title, quarter, status, scope_type, scope_ref, due_at::text,
                owner_email, launched_at::text, closed_at::text, created_at::text
         FROM admin_access_review_campaigns
         WHERE id = $1::uuid
         LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return null;
      const c = mapCampaign(row as Record<string, unknown>);
      c.item_counts = await this.loadCounts(id);
      return c;
    }
    return this.memoryCampaigns.find((c) => c.id === id) ?? null;
  }

  async patch(id: string, body: PatchAccessReviewCampaignBody): Promise<AccessReviewCampaign | null> {
    const existing = await this.getById(id);
    if (!existing || existing.status !== 'draft') return null;

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (body.title !== undefined) {
      sets.push(`title = $${idx++}`);
      params.push(String(body.title).trim());
    }
    if (body.quarter !== undefined) {
      sets.push(`quarter = $${idx++}`);
      params.push(String(body.quarter).trim());
    }
    if (body.scope_type !== undefined) {
      sets.push(`scope_type = $${idx++}`);
      params.push(body.scope_type);
    }
    if (body.scope_ref !== undefined) {
      sets.push(`scope_ref = $${idx++}`);
      params.push(body.scope_ref);
    }
    if (body.due_at !== undefined) {
      sets.push(`due_at = $${idx++}::timestamptz`);
      params.push(body.due_at);
    }
    if (body.owner_email !== undefined) {
      sets.push(`owner_email = $${idx++}`);
      params.push(String(body.owner_email).trim().toLowerCase());
    }

    params.push(id);

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE admin_access_review_campaigns SET ${sets.join(', ')}
         WHERE id = $${idx}::uuid AND status = 'draft'
         RETURNING id::text, title, quarter, status, scope_type, scope_ref, due_at::text,
                   owner_email, launched_at::text, closed_at::text, created_at::text`,
        params,
      );
      const row = result.rows[0];
      if (!row) return null;
      const c = mapCampaign(row as Record<string, unknown>);
      c.item_counts = await this.loadCounts(id);
      return c;
    }

    Object.assign(existing, body);
    return existing;
  }

  async markLaunched(id: string): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE admin_access_review_campaigns
         SET status = 'active', launched_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [id],
      );
      return;
    }
    const c = this.memoryCampaigns.find((x) => x.id === id);
    if (c) {
      c.status = 'active';
      c.launched_at = new Date().toISOString();
    }
  }

  async markClosed(id: string, status: 'completed' | 'cancelled'): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE admin_access_review_campaigns
         SET status = $2, closed_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [id, status],
      );
      return;
    }
    const c = this.memoryCampaigns.find((x) => x.id === id);
    if (c) {
      c.status = status;
      c.closed_at = new Date().toISOString();
    }
  }

  async insertItems(items: Omit<AccessReviewItem, 'id' | 'decision' | 'certifier_email' | 'certifier_note' | 'decided_at'>[]): Promise<number> {
    let inserted = 0;
    if (await this.ensurePgReady()) {
      for (const item of items) {
        await this.db.query(
          `INSERT INTO admin_access_review_items
             (campaign_id, user_id, user_email, user_display_name, position_code, team_ids, snapshot_json)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb)
           ON CONFLICT (campaign_id, user_id) DO NOTHING`,
          [
            item.campaign_id,
            item.user_id,
            item.user_email,
            item.user_display_name,
            item.position_code,
            JSON.stringify(item.team_ids),
            JSON.stringify(item.snapshot_json),
          ],
        );
        inserted += 1;
      }
      return inserted;
    }
    for (const item of items) {
      this.memoryItems.push({
        ...item,
        id: `mem-item-${Date.now()}-${inserted}`,
        decision: 'pending',
        certifier_email: null,
        certifier_note: null,
        decided_at: null,
      });
      inserted += 1;
    }
    return inserted;
  }

  async listItems(
    campaignId: string,
    opts?: { decision?: AccessReviewItemDecision; certifierEmail?: string; limit?: number; offset?: number },
  ): Promise<AccessReviewItem[]> {
    const limit = Math.min(opts?.limit ?? 100, 500);
    const offset = opts?.offset ?? 0;

    if (await this.ensurePgReady()) {
      const params: unknown[] = [campaignId];
      const filters = ['campaign_id = $1::uuid'];
      let idx = 2;
      if (opts?.decision) {
        filters.push(`decision = $${idx++}`);
        params.push(opts.decision);
      }
      if (opts?.certifierEmail) {
        filters.push(`EXISTS (
          SELECT 1 FROM staff_user_teams subject_team
          JOIN staff_user_teams lead_team ON lead_team.team_id = subject_team.team_id AND lead_team.team_role = 'lead'
          JOIN staff_users approver ON approver.id = lead_team.user_id
          WHERE subject_team.user_id = admin_access_review_items.user_id
            AND lower(approver.email) = lower($${idx++})
        )`);
        params.push(opts.certifierEmail);
      }
      params.push(limit, offset);
      const result = await this.db.query(
        `SELECT id::text, campaign_id::text, user_id::text, user_email, user_display_name,
                position_code, team_ids, snapshot_json, decision, certifier_email, certifier_note,
                decided_at::text
         FROM admin_access_review_items
         WHERE ${filters.join(' AND ')}
         ORDER BY user_email
         LIMIT $${idx++} OFFSET $${idx}`,
        params,
      );
      return result.rows.map((row) => mapItem(row as Record<string, unknown>));
    }
    return this.memoryItems
      .filter((i) => i.campaign_id === campaignId)
      .filter((i) => !opts?.decision || i.decision === opts.decision)
      .slice(offset, offset + limit);
  }

  async getItemById(itemId: string): Promise<(AccessReviewItem & { campaign_status: string; due_at: string }) | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT i.id::text, i.campaign_id::text, i.user_id::text, i.user_email, i.user_display_name,
                i.position_code, i.team_ids, i.snapshot_json, i.decision, i.certifier_email,
                i.certifier_note, i.decided_at::text, c.status AS campaign_status, c.due_at::text
         FROM admin_access_review_items i
         JOIN admin_access_review_campaigns c ON c.id = i.campaign_id
         WHERE i.id = $1::uuid
         LIMIT 1`,
        [itemId],
      );
      const row = result.rows[0];
      if (!row) return null;
      const item = mapItem(row as Record<string, unknown>);
      return {
        ...item,
        campaign_status: String(row.campaign_status),
        due_at: String(row.due_at),
      };
    }
    const item = this.memoryItems.find((i) => i.id === itemId);
    if (!item) return null;
    const campaign = this.memoryCampaigns.find((c) => c.id === item.campaign_id);
    return {
      ...item,
      campaign_status: campaign?.status ?? 'draft',
      due_at: campaign?.due_at ?? new Date().toISOString(),
    };
  }

  async patchItem(
    itemId: string,
    decision: AccessReviewItemDecision,
    certifierEmail: string,
    note?: string,
  ): Promise<AccessReviewItem | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE admin_access_review_items
         SET decision = $2, certifier_email = $3, certifier_note = $4, decided_at = NOW()
         WHERE id = $1::uuid
         RETURNING id::text, campaign_id::text, user_id::text, user_email, user_display_name,
                   position_code, team_ids, snapshot_json, decision, certifier_email,
                   certifier_note, decided_at::text`,
        [itemId, decision, certifierEmail, note ?? null],
      );
      const row = result.rows[0];
      return row ? mapItem(row as Record<string, unknown>) : null;
    }
    const item = this.memoryItems.find((i) => i.id === itemId);
    if (!item) return null;
    item.decision = decision;
    item.certifier_email = certifierEmail;
    item.certifier_note = note ?? null;
    item.decided_at = new Date().toISOString();
    return item;
  }

  async listRevokeRequested(campaignId: string): Promise<AccessReviewItem[]> {
    return this.listItems(campaignId, { decision: 'revoke_requested', limit: 500 });
  }

  async isTeamLeadForItem(itemId: string, actorEmail: string): Promise<boolean> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT 1
         FROM admin_access_review_items i
         JOIN staff_user_teams subject_team ON subject_team.user_id = i.user_id
         JOIN staff_user_teams lead_team ON lead_team.team_id = subject_team.team_id AND lead_team.team_role = 'lead'
         JOIN staff_users approver ON approver.id = lead_team.user_id
         WHERE i.id = $1::uuid AND lower(approver.email) = lower($2)
         LIMIT 1`,
        [itemId, actorEmail],
      );
      return Boolean(result.rows[0]);
    }
    return false;
  }

  async listInboxCampaignIds(actorEmail: string): Promise<string[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query<{ campaign_id: string }>(
        `SELECT DISTINCT i.campaign_id::text
         FROM admin_access_review_items i
         JOIN admin_access_review_campaigns c ON c.id = i.campaign_id
         JOIN staff_user_teams subject_team ON subject_team.user_id = i.user_id
         JOIN staff_user_teams lead_team ON lead_team.team_id = subject_team.team_id AND lead_team.team_role = 'lead'
         JOIN staff_users approver ON approver.id = lead_team.user_id
         WHERE c.status = 'active' AND i.decision = 'pending'
           AND lower(approver.email) = lower($1)`,
        [actorEmail],
      );
      return result.rows.map((r) => r.campaign_id);
    }
    return [];
  }
}

function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

function defaultDueAt(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString();
}
