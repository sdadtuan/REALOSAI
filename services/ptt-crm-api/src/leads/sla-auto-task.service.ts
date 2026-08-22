import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { LeadsService } from './leads.service';
import type { CskhSlaTier } from '../cskh-board/cskh-board-sla.util';
import { CSKH_SLA_TIER_LABELS } from '../cskh-board/cskh-board-sla.util';
import type { SlaPredictSuggestedAction } from '../cskh-board/sla-predict.util';

export interface SlaAutoTaskBody {
  tier: CskhSlaTier;
  suggested_action: SlaPredictSuggestedAction;
  message?: string;
}

@Injectable()
export class SlaAutoTaskService {
  constructor(
    private readonly legacy: CrmLeadsLegacyService,
    private readonly leads: LeadsService,
  ) {}

  async createReminder(
    leadId: number,
    body: SlaAutoTaskBody,
    actor: string,
    userId: number | null,
  ) {
    const lead = await this.leads.getLead(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
    }

    const tier = String(body.tier ?? '').trim() as CskhSlaTier;
    const action = String(body.suggested_action ?? '').trim() as SlaPredictSuggestedAction;
    if (!['first_call_15m', 'b2_complete_4h', 'close_24h'].includes(tier)) {
      throw new BadRequestException({ error: 'invalid_tier' });
    }
    if (!['log_call', 'complete_b2', 'set_chot_audit', 'set_lost_reason', 'reassign'].includes(action)) {
      throw new BadRequestException({ error: 'invalid_suggested_action' });
    }

    const tierLabel = CSKH_SLA_TIER_LABELS[tier] ?? tier;
    const note = String(body.message ?? '').trim() || `Nhắc ${action} — ${tierLabel}`;
    const content = `SLA auto: ${note}`;

    const { activity } = await this.legacy.createActivity(
      leadId,
      {
        activity_type: 'note',
        content,
        result: 'Reminder nội bộ — không auto-send khách (BR-AI-01).',
        next_action: `SLA ${action}`,
      },
      actor,
      userId,
    );

    return {
      ok: true,
      lead_id: leadId,
      activity_id: activity.id,
      content,
    };
  }
}
