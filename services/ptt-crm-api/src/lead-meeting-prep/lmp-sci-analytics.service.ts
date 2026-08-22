import { Injectable } from '@nestjs/common';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';

export interface LmpSciAnalyticsMetrics {
  window_days: number;
  prep_ready_count: number;
  prep_running_count: number;
  debrief_submitted_count: number;
  chot_with_sci_count: number;
  tier_mix: { CB: number; TC: number; CS: number; unknown: number };
  avg_close_readiness: number | null;
  helpful_rate_pct: number | null;
  top_objections: Array<{ objection: string; count: number }>;
}

@Injectable()
export class LmpSciAnalyticsService {
  constructor(private readonly repo: LeadMeetingPrepRepository) {}

  async getMetrics(windowDays = 30): Promise<LmpSciAnalyticsMetrics> {
    if (!(await this.repo.tableReady())) {
      return emptyMetrics(windowDays);
    }
    return this.repo.aggregateSciMetrics(windowDays);
  }
}

function emptyMetrics(windowDays: number): LmpSciAnalyticsMetrics {
  return {
    window_days: windowDays,
    prep_ready_count: 0,
    prep_running_count: 0,
    debrief_submitted_count: 0,
    chot_with_sci_count: 0,
    tier_mix: { CB: 0, TC: 0, CS: 0, unknown: 0 },
    avg_close_readiness: null,
    helpful_rate_pct: null,
    top_objections: [],
  };
}
