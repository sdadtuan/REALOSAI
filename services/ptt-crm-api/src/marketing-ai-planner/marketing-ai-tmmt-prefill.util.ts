import { buildPresalesMktAiBrief } from '../leads-funnel/presales-ai-draft.util';
import { planContentFromRow } from '../leads-funnel/presales-marketing-plan.util';
import { computeBriefReadiness } from './marketing-ai-brief-readiness.util';
import type { MktAiBrief } from './marketing-ai-planner.types';

export const TMMT_PREFILL_TARGET_SCORE = 80;
export const TMMT_PREFILL_SOURCE = 'l1-consult-bridge';

function appendNote(existing: string | undefined, line: string): string {
  const next = line.trim();
  if (!next) return existing?.trim() ?? '';
  if (!existing?.trim()) return next;
  if (existing.includes(next)) return existing;
  return `${existing.trim()}\n${next}`;
}

function parseCompetitors(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function mergeBriefField(brief: MktAiBrief, key: keyof MktAiBrief, value: unknown): void {
  if (value == null) return;
  if (key === 'budget_monthly_vnd') {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0 && !brief.budget_monthly_vnd) {
      brief.budget_monthly_vnd = n;
    }
    return;
  }
  if (key === 'geo_markets' || key === 'competitors') {
    const list = Array.isArray(value)
      ? value.map((x) => String(x).trim()).filter(Boolean)
      : String(value)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
    if (list.length && !(brief[key] as string[] | undefined)?.length) {
      brief[key] = list;
    }
    return;
  }
  const text = String(value).trim();
  if (!text) return;
  const current = brief[key];
  if (typeof current === 'string' && current.trim()) return;
  (brief as Record<string, unknown>)[key] = text;
}

/** P1-6 — Prefill TMMT Brief step 1 from Consult + L1 (R5 / official plan). */
export function buildTmmtPrefillFromL1AndConsult(input: {
  serviceSlug: string;
  leadName?: string;
  consultBrief?: Record<string, unknown> | null;
  l1PlanRow?: Record<string, unknown> | null;
}): { brief: MktAiBrief; sources: string[] } {
  const sources: string[] = [];
  const brief: MktAiBrief = { service_slug: input.serviceSlug };

  if (input.consultBrief) {
    Object.assign(
      brief,
      buildPresalesMktAiBrief({
        consultBrief: input.consultBrief,
        serviceSlug: input.serviceSlug,
        leadName: input.leadName ?? '',
      }),
    );
    sources.push('consult-brief');

    const leadTask = (input.consultBrief.lead_task ?? {}) as { form_data?: Record<string, unknown> };
    const form = leadTask.form_data ?? {};
    const competitors = parseCompetitors(form.competitors ?? form.competitor ?? form.doi_thu);
    if (competitors.length) {
      brief.competitors = competitors;
    }
  }

  if (input.l1PlanRow) {
    const plan = planContentFromRow(input.l1PlanRow);
    if (plan.name && !brief.brand_name) brief.brand_name = plan.name.replace(/^KH MKT sơ bộ.*—\s*/i, '').trim();
    if (plan.north_star) {
      brief.notes = appendNote(brief.notes, `North Star (L1): ${plan.north_star}`);
      if (!brief.objective) brief.objective = plan.north_star.slice(0, 500);
    }
    if (plan.objectives) {
      brief.notes = appendNote(brief.notes, `Mục tiêu (L1): ${plan.objectives}`);
      if (!brief.objective) brief.objective = plan.objectives.split('\n')[0]?.slice(0, 500);
    }

    const sf = plan.strategy_framework;
    mergeBriefField(brief, 'usp', sf.market_message);
    mergeBriefField(brief, 'challenges', sf.target_market ?? sf.conversion_strategy);
    if (sf.media_reach) {
      brief.notes = appendNote(brief.notes, `Media & Reach (L1): ${sf.media_reach}`);
    }
    if (sf.conversion_strategy) {
      brief.notes = appendNote(brief.notes, `Chuyển đổi (L1): ${sf.conversion_strategy}`);
    }
    sources.push('presales-l1-plan');
  }

  if (!brief.geo_markets?.length) {
    brief.geo_markets = ['Việt Nam'];
  }

  if (sources.length) {
    sources.push(TMMT_PREFILL_SOURCE);
  }

  return { brief, sources };
}

export function mergeTmmtPrefillBrief(
  existing: MktAiBrief | null | undefined,
  prefill: MktAiBrief,
): MktAiBrief {
  const out: MktAiBrief = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(prefill)) {
    if (value == null) continue;
    const current = out[key as keyof MktAiBrief];
    if (Array.isArray(value)) {
      if (!Array.isArray(current) || !(current as unknown[]).length) {
        (out as Record<string, unknown>)[key] = value;
      }
      continue;
    }
    if (typeof value === 'number') {
      if (current == null || (typeof current === 'number' && current <= 0)) {
        (out as Record<string, unknown>)[key] = value;
      }
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      if (typeof current !== 'string' || !current.trim()) {
        (out as Record<string, unknown>)[key] = value;
      }
    }
  }
  if (!out.service_slug && prefill.service_slug) out.service_slug = prefill.service_slug;
  return out;
}

export function assessTmmtPrefillReadiness(brief: MktAiBrief): {
  score: number;
  meets_target: boolean;
  target: number;
} {
  const score = computeBriefReadiness(brief).score;
  return {
    score,
    meets_target: score >= TMMT_PREFILL_TARGET_SCORE,
    target: TMMT_PREFILL_TARGET_SCORE,
  };
}
