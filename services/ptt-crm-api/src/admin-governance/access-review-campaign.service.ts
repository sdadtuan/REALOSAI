import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditRepository } from '../admin-audit/admin-audit.repository';
import { StaffAccessReviewActionsRepository } from '../staff-permissions/staff-access-review-actions.repository';
import { StaffOrgService } from '../staff-org/staff-org.service';
import { AccessReviewCampaignRepository } from './access-review-campaign.repository';
import type {
  AccessReviewCampaign,
  AccessReviewItem,
  AccessReviewItemDecision,
  CreateAccessReviewCampaignBody,
  PatchAccessReviewCampaignBody,
  PatchAccessReviewItemBody,
} from './admin-governance.types';

@Injectable()
export class AccessReviewCampaignService {
  constructor(
    private readonly repo: AccessReviewCampaignRepository,
    private readonly org: StaffOrgService,
    private readonly actions: StaffAccessReviewActionsRepository,
    private readonly audit: AdminAuditRepository,
  ) {}

  listCampaigns(status?: AccessReviewCampaign['status']) {
    return this.repo.list(status).then((campaigns) => ({ campaigns }));
  }

  async createCampaign(body: CreateAccessReviewCampaignBody, actorEmail: string) {
    const title = String(body.title ?? '').trim();
    if (title.length < 3) {
      throw new BadRequestException({ error: 'title_too_short' });
    }
    const campaign = await this.repo.create(body, actorEmail);
    await this.logAudit('access_review_campaign_created', actorEmail, campaign, {
      title: campaign.title,
      quarter: campaign.quarter,
    });
    return campaign;
  }

  async getCampaign(id: string) {
    const campaign = await this.repo.getById(id);
    if (!campaign) throw new NotFoundException({ error: 'campaign_not_found', id });
    return campaign;
  }

  async patchCampaign(id: string, body: PatchAccessReviewCampaignBody, actorEmail: string) {
    const updated = await this.repo.patch(id, body);
    if (!updated) {
      throw new BadRequestException({ error: 'campaign_not_editable', id });
    }
    await this.logAudit('access_review_campaign_updated', actorEmail, updated, body as Record<string, unknown>);
    return updated;
  }

  async launchCampaign(id: string, actorEmail: string) {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'draft') {
      throw new BadRequestException({ error: 'invalid_status', status: campaign.status });
    }

    const users = await this.resolveScopeUsers(campaign.scope_type, campaign.scope_ref);
    if (!users.length) {
      throw new BadRequestException({ error: 'empty_scope' });
    }

    const items = [];
    for (const user of users) {
      let effective;
      try {
        effective = await this.org.getEffectiveCaps(user.id);
      } catch {
        effective = { caps: [], job_functions: [], permission_sets: [] };
      }
      items.push({
        campaign_id: id,
        user_id: user.id,
        user_email: user.email,
        user_display_name: user.display_name,
        position_code: user.position_code ?? effective.position_code ?? null,
        team_ids: user.team_ids ?? [],
        snapshot_json: effective as unknown as Record<string, unknown>,
      });
    }

    const inserted = await this.repo.insertItems(items);
    await this.repo.markLaunched(id);
    const launched = await this.getCampaign(id);
    await this.logAudit('access_review_campaign_launched', actorEmail, launched, {
      item_count: inserted,
    });
    return { ok: true, launched: inserted, campaign: launched };
  }

  async listItems(
    campaignId: string,
    opts?: { decision?: AccessReviewItemDecision; certifierEmail?: string; limit?: number; offset?: number },
  ) {
    await this.getCampaign(campaignId);
    const items = await this.repo.listItems(campaignId, opts);
    const campaign = await this.getCampaign(campaignId);
    const dueMs = new Date(campaign.due_at).getTime();
    const enriched = items.map((item) => enrichItem(item, dueMs));
    return { items: enriched, campaign_id: campaignId };
  }

  async listInbox(actorEmail: string, campaignId?: string) {
    const campaignIds = campaignId
      ? [campaignId]
      : await this.repo.listInboxCampaignIds(actorEmail);
    const items: AccessReviewItem[] = [];
    for (const id of campaignIds) {
      const batch = await this.repo.listItems(id, {
        decision: 'pending',
        certifierEmail: actorEmail,
        limit: 200,
      });
      const campaign = await this.repo.getById(id);
      const dueMs = campaign ? new Date(campaign.due_at).getTime() : Date.now();
      items.push(...batch.map((item) => enrichItem(item, dueMs)));
    }
    items.sort((a, b) => a.user_email.localeCompare(b.user_email, 'vi'));
    return { items, count: items.length };
  }

  async patchItem(itemId: string, body: PatchAccessReviewItemBody, actorEmail: string) {
    const existing = await this.repo.getItemById(itemId);
    if (!existing) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (existing.campaign_status !== 'active') {
      throw new BadRequestException({ error: 'campaign_not_active' });
    }
    const decision = body.decision;
    if (!decision || decision === 'pending') {
      throw new BadRequestException({ error: 'invalid_decision' });
    }
    const updated = await this.repo.patchItem(itemId, decision, actorEmail, body.note);
    if (!updated) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    await this.logAudit('access_review_item_decision', actorEmail, { id: existing.campaign_id, title: '', quarter: '', status: 'active', scope_type: 'all', scope_ref: null, due_at: existing.due_at, owner_email: '', launched_at: null, closed_at: null, item_counts: { pending: 0, certified: 0, revoke: 0, total: 0 }, created_at: '' }, {
      item_id: itemId,
      user_email: updated.user_email,
      decision,
    });
    return updated;
  }

  async bulkPatchItems(
    itemIds: string[],
    body: PatchAccessReviewItemBody,
    actorEmail: string,
  ) {
    const applied = [];
    for (const id of itemIds ?? []) {
      try {
        applied.push(await this.patchItem(id, body, actorEmail));
      } catch {
        // skip unauthorized or invalid
      }
    }
    return { ok: true, applied: applied.length, items: applied };
  }

  async closeCampaign(id: string, actorEmail: string, force = false) {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'active') {
      throw new BadRequestException({ error: 'invalid_status', status: campaign.status });
    }
    if (!force && campaign.item_counts.pending > 0) {
      throw new BadRequestException({
        error: 'pending_items_remain',
        pending: campaign.item_counts.pending,
      });
    }

    const revokes = await this.repo.listRevokeRequested(id);
    let appliedRevokes = 0;
    for (const item of revokes) {
      try {
        await this.org.patchUser(item.user_id, { active: false }, actorEmail);
        appliedRevokes += 1;
        await this.actions.insertMany(
          campaign.quarter,
          [{ user_email: item.user_email, action: 'revoke', note: `campaign:${id}` }],
          actorEmail,
        );
      } catch {
        // continue
      }
    }

    await this.repo.markClosed(id, 'completed');
    const closed = await this.getCampaign(id);
    await this.logAudit('access_review_campaign_closed', actorEmail, closed, {
      applied_revokes: appliedRevokes,
    });
    return { ok: true, applied_revokes: appliedRevokes, campaign: closed };
  }

  async cancelCampaign(id: string, actorEmail: string) {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'draft') {
      throw new BadRequestException({ error: 'invalid_status', status: campaign.status });
    }
    await this.repo.markClosed(id, 'cancelled');
    return this.getCampaign(id);
  }

  private async resolveScopeUsers(
    scopeType: AccessReviewCampaign['scope_type'],
    scopeRef: string | null,
  ) {
    const users = await this.org.listUsers({ includeInactive: false });
    if (scopeType === 'all' || !scopeRef) return users;

    if (scopeType === 'team') {
      const teamId = Number(scopeRef);
      return users.filter((u) => (u.team_ids ?? []).includes(teamId));
    }

    if (scopeType === 'department') {
      const deptId = Number(scopeRef);
      const teams = await this.org.listTeams();
      const teamIds = new Set(
        teams.filter((t) => Number(t.department_id) === deptId).map((t) => Number(t.id)),
      );
      return users.filter((u) => (u.team_ids ?? []).some((tid) => teamIds.has(tid)));
    }

    if (scopeType === 'permission_set') {
      const code = scopeRef.trim().toLowerCase();
      const matched = [];
      for (const user of users) {
        try {
          const effective = await this.org.getEffectiveCaps(user.id);
          const sets = (effective.permission_sets ?? []).map((s) => String(s).toLowerCase());
          if (sets.includes(code)) matched.push(user);
        } catch {
          // skip
        }
      }
      return matched;
    }

    return users;
  }

  private async logAudit(
    eventType: string,
    actorEmail: string,
    campaign: AccessReviewCampaign,
    diff: Record<string, unknown>,
  ) {
    await this.audit.logSyntheticEvent({
      event_type: eventType,
      actor_email: actorEmail,
      category: 'rbac_event',
      severity: eventType.includes('launched') ? 'warning' : 'info',
      subject_label: campaign.title || campaign.quarter,
      subject_id: campaign.id,
      action: eventType,
      summary: `Access review — ${campaign.title} (${campaign.quarter})`,
      diff_json: { campaign_id: campaign.id, ...diff },
    });
  }
}

function enrichItem(item: AccessReviewItem, dueMs: number): AccessReviewItem {
  const daysUntilDue = Math.ceil((dueMs - Date.now()) / 86_400_000);
  const caps = Array.isArray((item.snapshot_json as { caps?: unknown[] }).caps)
    ? ((item.snapshot_json as { caps: Array<{ section?: string; action?: string }> }).caps ?? [])
    : [];
  const riskFlags: string[] = [];
  const sensitive = caps.some(
    (c) =>
      String(c.action).includes('configure') ||
      String(c.action).includes('view_pii') ||
      String(c.section).includes('crm_data_config'),
  );
  if (sensitive) riskFlags.push('elevated_caps');
  return {
    ...item,
    days_until_due: daysUntilDue,
    risk_flags: riskFlags,
  };
}
