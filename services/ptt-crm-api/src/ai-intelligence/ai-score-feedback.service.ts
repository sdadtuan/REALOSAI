import { Injectable, Logger } from '@nestjs/common';
import {
  AiScoreFeedbackRepository,
  type ScoreFeedbackOutcome,
} from './ai-score-feedback.repository';

@Injectable()
export class AiScoreFeedbackService {
  private readonly log = new Logger(AiScoreFeedbackService.name);

  constructor(private readonly repo: AiScoreFeedbackRepository) {}

  async recordOverride(input: {
    leadId: number;
    staffId: string;
    overrideScore: number;
  }): Promise<void> {
    if (!(await this.repo.tableReady())) return;
    try {
      await this.repo.insertOverride(input);
    } catch (err) {
      this.log.warn(`override feedback failed lead=${input.leadId}: ${String(err)}`);
    }
  }

  async onLeadTerminalStatus(leadId: number, status: string): Promise<void> {
    const normalized = String(status ?? '').trim().toLowerCase();
    let outcome: ScoreFeedbackOutcome | null = null;
    if (normalized === 'chot' || normalized === 'won' || normalized === 'post_sale') {
      outcome = 'chot';
    } else if (normalized === 'lost') {
      outcome = 'lost';
    }
    if (!outcome) return;
    if (!(await this.repo.tableReady())) return;
    try {
      const updated = await this.repo.backfillOutcome(leadId, outcome);
      if (updated === 0) {
        await this.repo.insertOutcomeRows(leadId, outcome);
      }
    } catch (err) {
      this.log.warn(`outcome feedback failed lead=${leadId}: ${String(err)}`);
    }
  }

  async aggregateForLead(leadId: number) {
    if (!(await this.repo.tableReady())) {
      return {
        override_count: 0,
        avg_override_score: null,
        outcome_chot: 0,
        outcome_lost: 0,
        outcome_stalled: 0,
      };
    }
    return this.repo.aggregateForLead(leadId);
  }
}
