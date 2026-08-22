import type { MktAiBrief } from '../marketing-ai-planner/marketing-ai-planner.types';
import type { MktAiStrategyOutput } from '../marketing-ai-planner/marketing-ai-orchestrator.util';
import { STRATEGY_FRAMEWORK_KEYS } from '../marketing-ai-planner/marketing-ai-prompts';
import type { PatchMarketingPlanBody } from './leads-funnel.types';
import { defaultStrategyJson } from './presales-marketing-plan.util';

export function buildPresalesMktAiBrief(input: {
  consultBrief: Record<string, unknown>;
  serviceSlug: string;
  leadName: string;
}): MktAiBrief {
  const highlights = (input.consultBrief.highlights ?? {}) as Record<string, unknown>;
  const companyName = String(input.consultBrief.company_name ?? '').trim();
  const brief: MktAiBrief = { service_slug: input.serviceSlug };

  if (companyName) brief.brand_name = companyName;
  else if (input.leadName.trim()) brief.brand_name = input.leadName.trim();

  if (highlights.niche) brief.industry = String(highlights.niche);
  if (highlights.pain) brief.challenges = String(highlights.pain);
  if (highlights.budget_vnd != null) brief.budget_monthly_vnd = Number(highlights.budget_vnd);
  if (highlights.goal) brief.objective = String(highlights.goal);
  if (highlights.domain) brief.website_url = String(highlights.domain);

  const leadTask = (input.consultBrief.lead_task ?? {}) as { form_data?: Record<string, unknown> };
  const form = leadTask.form_data ?? {};
  if (!brief.industry && form.niche) brief.industry = String(form.niche);
  if (!brief.challenges && form.need) brief.challenges = String(form.need);
  if (!brief.objective && form.goal) brief.objective = String(form.goal);
  if (!brief.budget_monthly_vnd && form.budget != null && form.budget !== '') {
    brief.budget_monthly_vnd = Number(form.budget);
  }

  return brief;
}

export function mapStrategyToPreliminaryPlan(
  strategy: MktAiStrategyOutput,
  input: {
    leadId: number;
    serviceSlug: string;
    brief: MktAiBrief;
    existingName?: string;
  },
): PatchMarketingPlanBody & { target_market_prof?: Record<string, string> } {
  const strategyFramework: Record<string, string> = { ...defaultStrategyJson() };
  for (const key of STRATEGY_FRAMEWORK_KEYS) {
    const val = strategy.strategy_framework?.[key];
    if (typeof val === 'string' && val.trim()) strategyFramework[key] = val.trim();
  }

  const brand = String(input.brief.brand_name ?? `Lead #${input.leadId}`).trim();
  const northStar =
    String(strategyFramework.target_market ?? '').split(/[.!?\n]/)[0]?.trim().slice(0, 200) ||
    `${brand} — mục tiêu ${String(input.brief.objective ?? 'tăng trưởng')}`;

  const objectiveParts = [
    input.brief.challenges ? `Thách thức: ${String(input.brief.challenges).trim()}` : '',
    strategyFramework.market_message,
    strategyFramework.conversion_strategy,
  ].filter(Boolean);

  const defaultName = `KH MKT sơ bộ (AI) — Lead #${input.leadId}${
    input.serviceSlug ? ` (${input.serviceSlug})` : ''
  }`;

  return {
    name: (input.existingName ?? '').trim() || defaultName,
    north_star: northStar,
    objectives: objectiveParts.join('\n\n').slice(0, 4000),
    strategy_framework: strategyFramework,
    target_market_prof: strategy.target_market_prof,
  };
}
