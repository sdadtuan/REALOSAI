import { Injectable, NotFoundException } from '@nestjs/common';
import { buildTopFeatures } from '../ai-intelligence/lead-score.engine';
import {
  computeB2bAiBand,
  isB2bInHoursNow,
} from './b2b-lead-list.util';
import { resolveB2bNba, type B2bNbaResult } from './b2b-nba.util';
import { B2bCallsRepository } from './b2b-calls.repository';
import { B2bIntelligenceRepository } from './b2b-intelligence.repository';

export interface B2bLeadScoreCard {
  score: number | null;
  band: 'hot' | 'warm' | 'cold';
  reasons: { feature: string; direction: '+' | '-'; weight: number }[];
}

export interface B2bLeadIntelligenceResponse {
  lead_id: number;
  score: B2bLeadScoreCard;
  nba: B2bNbaResult | null;
}

@Injectable()
export class B2bIntelligenceService {
  constructor(
    private readonly intelRepo: B2bIntelligenceRepository,
    private readonly calls: B2bCallsRepository,
  ) {}

  async getLeadIntelligence(leadId: number): Promise<B2bLeadIntelligenceResponse> {
    const hasCall = await this.calls.hasHumanDial(leadId);
    const ctx = await this.intelRepo.loadLeadContext(leadId, hasCall);
    if (!ctx) {
      throw new NotFoundException({ error: 'Not found' });
    }

    let scoreValue = ctx.score;
    let reasons: B2bLeadScoreCard['reasons'] = [];
    let band = computeB2bAiBand(scoreValue);

    const latest = await this.intelRepo.loadLatestScore(leadId);
    if (latest) {
      scoreValue = latest.score_value;
      band = computeB2bAiBand(scoreValue);
      reasons = buildTopFeatures(latest.explainability_json);
    }

    const assignedDt = ctx.received_at ? new Date(ctx.received_at) : null;
    const elapsedMin =
      assignedDt && !Number.isNaN(assignedDt.getTime())
        ? Math.max(0, (Date.now() - assignedDt.getTime()) / 60_000)
        : 0;

    const nba = resolveB2bNba({
      score: scoreValue,
      slaState: ctx.sla_state,
      elapsedMin,
      hasCall,
      hasNote: ctx.has_note,
      hasMeeting: ctx.has_meeting,
      inHours: isB2bInHoursNow(),
    });

    return {
      lead_id: leadId,
      score: {
        score: scoreValue,
        band,
        reasons,
      },
      nba,
    };
  }
}
