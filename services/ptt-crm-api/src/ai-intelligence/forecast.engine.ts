import { computeDealScoreV1 } from './deal-score.engine';
import { DealScoreContext } from './deal-score.types';
import {
  ForecastDealRow,
  ForecastEngineInput,
  ForecastEngineResult,
  ForecastStageBucket,
} from './forecast.types';
import { LeadScoreFactor } from './lead-score.types';
import { pipelineStageLabel } from '../sales/sales-pipeline.util';

const STAGE_WIN_PROB: Record<string, number> = {
  moi: 0.1,
  dang_lien_he: 0.2,
  mql: 0.3,
  sql: 0.5,
  bao_gia: 0.7,
  chot: 0.95,
  mat: 0,
};

function roundVnd(value: number): number {
  return Math.round(Math.max(0, value));
}

function stageWeight(stage: string): number {
  return STAGE_WIN_PROB[stage] ?? 0.35;
}

export function buildForecastDealRow(ctx: DealScoreContext): ForecastDealRow {
  const scored = computeDealScoreV1(ctx);
  const weight = stageWeight(ctx.pipelineStage);
  return {
    deal_id: ctx.dealId,
    title: ctx.title,
    pipeline_stage: ctx.pipelineStage,
    deal_value_vnd: ctx.dealValueVnd,
    weighted_vnd: roundVnd(ctx.dealValueVnd * weight),
    stalled_days: scored.stalledDays,
    is_stalled: scored.isStalled,
  };
}

export function computeRevenueForecastV1(input: ForecastEngineInput): ForecastEngineResult {
  const now = input.now ?? new Date();
  const factors: LeadScoreFactor[] = [];
  const stageMap = new Map<string, ForecastStageBucket>();

  let pipelineAmount = 0;
  let bestCaseAmount = 0;
  let stalledCount = 0;
  let stallPenalty = 0;

  for (const deal of input.deals) {
    pipelineAmount += deal.weighted_vnd;
    bestCaseAmount += deal.deal_value_vnd;

    const label = pipelineStageLabel(deal.pipeline_stage);
    const bucket = stageMap.get(deal.pipeline_stage) ?? {
      stage: deal.pipeline_stage,
      label,
      deal_count: 0,
      raw_vnd: 0,
      weighted_vnd: 0,
    };
    bucket.deal_count += 1;
    bucket.raw_vnd += deal.deal_value_vnd;
    bucket.weighted_vnd += deal.weighted_vnd;
    stageMap.set(deal.pipeline_stage, bucket);

    if (deal.is_stalled) {
      stalledCount += 1;
      stallPenalty += roundVnd(deal.deal_value_vnd * 0.05);
    }
  }

  factors.push({
    key: 'weighted_pipeline',
    label: `Pipeline weighted (${input.deals.length} deal)`,
    delta: pipelineAmount,
    sign: '+',
  });

  if (stalledCount > 0) {
    factors.push({
      key: 'stalled_penalty',
      label: `− ${stalledCount} deal đứng im ≥7 ngày`,
      delta: stallPenalty,
      sign: '-',
    });
  }

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const seasonalityPct = dayOfMonth >= Math.floor(daysInMonth * 0.75) ? 0.02 : 0;
  const seasonalityAdj = roundVnd(pipelineAmount * seasonalityPct);
  if (seasonalityAdj > 0) {
    factors.push({
      key: 'seasonality_month_end',
      label: '+ Cuối tháng — điều chỉnh mùa vụ nhẹ',
      delta: seasonalityAdj,
      sign: '+',
    });
  }

  const aiAdjustment = seasonalityAdj - stallPenalty;
  const forecastAmount = roundVnd(pipelineAmount + aiAdjustment);
  const confidence =
    input.deals.length === 0
      ? 0.5
      : Math.min(0.92, 0.55 + Math.min(input.deals.length, 20) * 0.015 - stalledCount * 0.02);

  const summaryNote =
    stalledCount > 0
      ? `${stalledCount} deal >7 ngày stalled — xem NBA trên /crm/sales`
      : 'Pipeline ổn định — không có deal stalled nghiêm trọng.';

  return {
    pipeline_amount: roundVnd(pipelineAmount),
    forecast_amount: forecastAmount,
    ai_adjustment: aiAdjustment,
    best_case_amount: roundVnd(bestCaseAmount),
    confidence_score: Math.round(confidence * 10_000) / 10_000,
    stalled_deal_count: stalledCount,
    factors,
    stage_buckets: [...stageMap.values()].sort((a, b) => b.weighted_vnd - a.weighted_vnd),
    summary_note: summaryNote,
  };
}
