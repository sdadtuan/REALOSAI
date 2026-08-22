import {
  LeadScoreContext,
  LeadScoreEngineResult,
  LeadScoreExplainability,
  LeadScoreFactor,
  ScoreBand,
  type ScoreFeedbackAggregate,
  type ScoreReason,
} from './lead-score.types';

const RAW_PHONE_RE = /(\+?84|0)\d{8,10}/;

export function buildTopFeatures(
  explainability: LeadScoreExplainability,
  max = 5,
): ScoreReason[] {
  return sanitizeScoreReasons(
    [...explainability.factors]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, max)
      .map((factor) => ({
        feature: factor.label.replace(/^[+\−-]\s*/, '').trim(),
        direction: factor.sign,
        weight: factor.delta,
      })),
  );
}

export function sanitizeScoreReasons(reasons: ScoreReason[]): ScoreReason[] {
  return reasons.filter(
    (reason) => !RAW_PHONE_RE.test(reason.feature) && !RAW_PHONE_RE.test(String(reason.weight)),
  );
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreBand(score: number): ScoreBand {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function hoursSince(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
}

function baseSourceScore(ctx: LeadScoreContext, factors: LeadScoreFactor[], flags: string[]): number {
  const channel = String(ctx.channel ?? ctx.source ?? '')
    .trim()
    .toLowerCase();
  const hasCampaign = Boolean(ctx.campaignId?.trim());

  if (channel === 'meta' || channel === 'facebook') {
    if (hasCampaign) {
      factors.push({ key: 'source_meta_campaign', label: '+ Nguồn Meta Ads (có campaign)', delta: 20, sign: '+' });
      return 20;
    }
    factors.push({ key: 'source_meta', label: '+ Nguồn Meta Ads', delta: 12, sign: '+' });
    flags.push('attribution_incomplete');
    factors.push({ key: 'no_campaign', label: '− Chưa map campaign', delta: 5, sign: '-' });
    return 7;
  }

  if (channel === 'zalo') {
    factors.push({ key: 'source_zalo', label: '+ Nguồn Zalo OA/Form', delta: 15, sign: '+' });
    if (!hasCampaign) {
      flags.push('attribution_incomplete');
      factors.push({ key: 'no_campaign', label: '− Chưa map campaign', delta: 3, sign: '-' });
      return 12;
    }
    return 15;
  }

  if (channel === 'google') {
    factors.push({ key: 'source_google', label: '+ Nguồn Google Ads', delta: 12, sign: '+' });
    return 12;
  }

  if (!channel) {
    flags.push('attribution_incomplete');
    factors.push({ key: 'unknown_source', label: '− Chưa xác định nguồn', delta: 5, sign: '-' });
    return 5;
  }

  factors.push({ key: 'source_other', label: '+ Nguồn CRM/webhook', delta: 8, sign: '+' });
  return 8;
}

function slaBonus(ctx: LeadScoreContext, factors: LeadScoreFactor[]): number {
  if (!ctx.firstContactAt) {
    return 0;
  }
  const minutes = (ctx.firstContactAt.getTime() - ctx.receivedAt.getTime()) / 60_000;
  if (minutes <= 15) {
    factors.push({ key: 'sla_15m', label: '+ Liên hệ trong 15 phút', delta: 10, sign: '+' });
    return 10;
  }
  if (minutes <= 60) {
    factors.push({ key: 'sla_60m', label: '+ Liên hệ trong 1 giờ', delta: 5, sign: '+' });
    return 5;
  }
  return 0;
}

function valueBonus(ctx: LeadScoreContext, factors: LeadScoreFactor[]): number {
  const value = ctx.estimatedDealValueVnd;
  if (value == null || value <= 0) {
    return 0;
  }
  if (value >= 100_000_000) {
    factors.push({ key: 'value_high', label: '+ Giá trị deal cao', delta: 15, sign: '+' });
    return 15;
  }
  if (value >= 50_000_000) {
    factors.push({ key: 'value_mid', label: '+ Giá trị deal trung bình', delta: 10, sign: '+' });
    return 10;
  }
  if (value >= 20_000_000) {
    factors.push({ key: 'value_low', label: '+ Có ngân sách ước tính', delta: 5, sign: '+' });
    return 5;
  }
  return 0;
}

function duplicatePenalty(ctx: LeadScoreContext, factors: LeadScoreFactor[]): number {
  if (!ctx.isDuplicate) {
    return 0;
  }
  factors.push({ key: 'duplicate', label: '− Lead trùng lặp', delta: 30, sign: '-' });
  return 30;
}

function stalePenalty(ctx: LeadScoreContext, factors: LeadScoreFactor[], now: Date): number {
  const hours = hoursSince(ctx.receivedAt, now);
  if (hours < 24) {
    return 0;
  }
  const days = Math.floor(hours / 24);
  const penalty = Math.min(20, days * 5);
  if (penalty > 0) {
    factors.push({
      key: 'stale',
      label: `− Lead cũ (${days} ngày)`,
      delta: penalty,
      sign: '-',
    });
  }
  return penalty;
}

function timelineBonus(ctx: LeadScoreContext, factors: LeadScoreFactor[]): number {
  if (ctx.timelineEventCount >= 3) {
    factors.push({ key: 'timeline_rich', label: '+ Nhiều tương tác timeline', delta: 5, sign: '+' });
    return 5;
  }
  if (ctx.timelineEventCount >= 1) {
    factors.push({ key: 'timeline_present', label: '+ Có timeline context', delta: 2, sign: '+' });
    return 2;
  }
  return 0;
}

function formatVndShort(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function cplAttributionScore(ctx: LeadScoreContext, factors: LeadScoreFactor[], flags: string[]): number {
  if (ctx.cplVnd == null || ctx.targetCplVnd == null || ctx.targetCplVnd <= 0) {
    return 0;
  }
  if (ctx.cplOverTarget) {
    flags.push('cpl_over_target');
    factors.push({
      key: 'cpl_over_target',
      label: `− CPL ${formatVndShort(ctx.cplVnd)} > target ${formatVndShort(ctx.targetCplVnd)}`,
      delta: 8,
      sign: '-',
    });
    return -8;
  }
  factors.push({
    key: 'cpl_on_target',
    label: `+ CPL ${formatVndShort(ctx.cplVnd)} trong target`,
    delta: 5,
    sign: '+',
  });
  return 5;
}

function computeConfidence(ctx: LeadScoreContext, flags: string[]): number {
  let confidence = 0.45;
  if (ctx.channel) confidence += 0.1;
  if (ctx.campaignId) confidence += 0.1;
  if (ctx.firstContactAt) confidence += 0.1;
  if (ctx.timelineEventCount > 0) confidence += 0.05;
  if (flags.includes('attribution_incomplete')) confidence -= 0.08;
  return clamp(0.35, 0.92, Math.round(confidence * 1000) / 1000);
}

/** RNOS-04 rules engine v1 — deterministic, no LLM. */
export function computeLeadScoreV1(
  ctx: LeadScoreContext,
  now: Date = new Date(),
): LeadScoreEngineResult {
  const factors: LeadScoreFactor[] = [];
  const flags: string[] = [];

  const base = 35;
  factors.push({ key: 'base', label: 'Điểm nền lead mới', delta: base, sign: '+' });

  const total =
    base +
    baseSourceScore(ctx, factors, flags) +
    slaBonus(ctx, factors) +
    valueBonus(ctx, factors) +
    timelineBonus(ctx, factors) +
    cplAttributionScore(ctx, factors, flags) -
    duplicatePenalty(ctx, factors) -
    stalePenalty(ctx, factors, now);

  const score = clamp(0, 100, Math.round(total));
  const explainability: LeadScoreExplainability = {
    factors,
    flags,
    score_band: scoreBand(score),
  };

  return {
    score,
    confidence: computeConfidence(ctx, flags),
    explainability,
    top_features: buildTopFeatures(explainability),
    features: {
      channel: ctx.channel,
      source: ctx.source,
      campaign_id: ctx.campaignId,
      campaign_name: ctx.campaignName ?? null,
      cpl_vnd: ctx.cplVnd ?? null,
      target_cpl_vnd: ctx.targetCplVnd ?? null,
      is_duplicate: ctx.isDuplicate,
      hours_since_received: Math.round(hoursSince(ctx.receivedAt, now) * 10) / 10,
      timeline_events: ctx.timelineEventCount,
      first_contact_minutes: ctx.firstContactAt
        ? Math.round((ctx.firstContactAt.getTime() - ctx.receivedAt.getTime()) / 60_000)
        : null,
      estimated_deal_value_vnd: ctx.estimatedDealValueVnd,
    },
  };
}

/** E4 — deterministic feedback adjustment from override/outcome rows (±5 max). */
export function computeFeedbackScoreAdjustment(agg: ScoreFeedbackAggregate): number {
  let delta = 0;
  if (agg.override_count >= 1 && agg.avg_override_score != null) {
    if (agg.avg_override_score >= 75) delta += 2;
    else if (agg.avg_override_score <= 35) delta -= 2;
  }
  if (agg.outcome_chot > 0) delta += Math.min(3, agg.outcome_chot);
  if (agg.outcome_lost > 0) delta -= Math.min(3, agg.outcome_lost);
  if (agg.outcome_stalled > 0) delta -= 1;
  return clamp(-5, 5, delta);
}

/** E4 — v1 + closed-loop feedback weight (no ML server). */
export function computeLeadScoreV2(
  ctx: LeadScoreContext,
  feedback: ScoreFeedbackAggregate | null | undefined,
  now: Date = new Date(),
): LeadScoreEngineResult {
  const v1 = computeLeadScoreV1(ctx, now);
  if (!feedback || feedback.override_count + feedback.outcome_chot + feedback.outcome_lost + feedback.outcome_stalled === 0) {
    return v1;
  }

  const adjustment = computeFeedbackScoreAdjustment(feedback);
  if (adjustment === 0) return v1;

  const score = clamp(0, 100, v1.score + adjustment);
  const factors: LeadScoreFactor[] = [
    ...v1.explainability.factors,
    {
      key: 'feedback_closed_loop',
      label:
        adjustment > 0
          ? `+ Feedback closed-loop (+${adjustment})`
          : `− Feedback closed-loop (${adjustment})`,
      delta: Math.abs(adjustment),
      sign: adjustment > 0 ? '+' : '-',
    },
  ];

  const explainability = {
    factors,
    flags: [...v1.explainability.flags, 'score_v2_feedback'],
    score_band: scoreBand(score),
  };

  return {
    score,
    confidence: v1.confidence,
    explainability,
    top_features: buildTopFeatures(explainability),
    features: {
      ...v1.features,
      feedback_override_count: feedback.override_count,
      feedback_outcome_chot: feedback.outcome_chot,
      feedback_outcome_lost: feedback.outcome_lost,
      feedback_adjustment: adjustment,
    },
  };
}
