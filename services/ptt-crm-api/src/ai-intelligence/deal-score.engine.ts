import {
  DealScoreContext,
  DealScoreEngineResult,
} from './deal-score.types';
import { LeadScoreFactor, ScoreBand } from './lead-score.types';
import { STAGE_SLA_HOURS } from '../sales/sales-pipeline.util';

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function daysSince(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

function stageBaseScore(ctx: DealScoreContext, factors: LeadScoreFactor[]): number {
  const map: Record<string, number> = {
    moi: 35,
    dang_lien_he: 45,
    mql: 55,
    sql: 65,
    bao_gia: 72,
    chot: 95,
    mat: 10,
  };
  const base = map[ctx.pipelineStage] ?? 40;
  factors.push({
    key: `stage_${ctx.pipelineStage}`,
    label: `+ Stage ${ctx.pipelineStage}`,
    delta: base,
    sign: '+',
  });
  return base;
}

function valueBonus(ctx: DealScoreContext, factors: LeadScoreFactor[]): number {
  const value = ctx.dealValueVnd;
  if (value >= 100_000_000) {
    factors.push({ key: 'deal_value_high', label: '+ Giá trị deal cao', delta: 12, sign: '+' });
    return 12;
  }
  if (value >= 30_000_000) {
    factors.push({ key: 'deal_value_mid', label: '+ Giá trị deal trung bình', delta: 8, sign: '+' });
    return 8;
  }
  if (value > 0) {
    factors.push({ key: 'deal_value_low', label: '+ Có giá trị deal', delta: 4, sign: '+' });
    return 4;
  }
  return 0;
}

function activityAdjust(ctx: DealScoreContext, factors: LeadScoreFactor[], flags: string[]): number {
  if (ctx.activityCount7d >= 2) {
    factors.push({ key: 'recent_activity', label: '+ Hoạt động 7 ngày gần đây', delta: 10, sign: '+' });
    return 10;
  }
  if (ctx.activityCount7d === 1) {
    factors.push({ key: 'some_activity', label: '+ Có activity gần đây', delta: 5, sign: '+' });
    return 5;
  }
  flags.push('no_recent_activity');
  factors.push({ key: 'no_activity_7d', label: '− Không activity 7 ngày', delta: 15, sign: '-' });
  return -15;
}

function staleStagePenalty(ctx: DealScoreContext, factors: LeadScoreFactor[], now: Date): number {
  const days = daysSince(ctx.stageEnteredAt, now);
  const slaHours = STAGE_SLA_HOURS[ctx.pipelineStage] ?? 72;
  const slaDays = Math.max(1, slaHours / 24);
  if (days <= slaDays) return 0;
  const over = Math.min(25, Math.floor(days - slaDays) * 4);
  if (over > 0) {
    factors.push({
      key: 'stage_stale',
      label: `− Trễ SLA stage (${Math.floor(days)} ngày)`,
      delta: over,
      sign: '-',
    });
  }
  return over;
}

export function computeDealScoreV1(ctx: DealScoreContext, now = new Date()): DealScoreEngineResult {
  const factors: LeadScoreFactor[] = [];
  const flags: string[] = [];

  if (ctx.isTerminal) {
    if (ctx.pipelineStage === 'chot') {
      return {
        score: 95,
        confidence: 0.9,
        explainability: { factors: [{ key: 'won', label: '+ Deal đã chốt', delta: 95, sign: '+' }], flags: [], score_band: 'hot' },
        features: { pipeline_stage: ctx.pipelineStage, terminal: true },
        stalledDays: 0,
        isStalled: false,
      };
    }
    return {
      score: 10,
      confidence: 0.85,
      explainability: { factors: [{ key: 'lost', label: '− Deal mất', delta: 10, sign: '-' }], flags: ['terminal_lost'], score_band: 'cold' },
      features: { pipeline_stage: ctx.pipelineStage, terminal: true },
      stalledDays: 0,
      isStalled: false,
    };
  }

  let score = stageBaseScore(ctx, factors);
  score += valueBonus(ctx, factors);
  score += activityAdjust(ctx, factors, flags);
  score -= staleStagePenalty(ctx, factors, now);

  const stalledDays = Math.floor(daysSince(ctx.lastActivityAt ?? ctx.stageEnteredAt, now));
  const isStalled = stalledDays >= 7;

  if (isStalled) {
    flags.push('stalled_7d');
    factors.push({ key: 'stalled', label: `− Deal đứng im ${stalledDays} ngày`, delta: 10, sign: '-' });
    score -= 10;
  }

  score = clamp(0, 100, score);
  const confidence = ctx.activityCount7d > 0 ? 0.78 : 0.62;

  return {
    score,
    confidence,
    explainability: { factors, flags, score_band: scoreBand(score) },
    features: {
      pipeline_stage: ctx.pipelineStage,
      deal_value_vnd: ctx.dealValueVnd,
      activity_count_7d: ctx.activityCount7d,
      stalled_days: stalledDays,
      is_stalled: isStalled,
    },
    stalledDays,
    isStalled,
  };
}
