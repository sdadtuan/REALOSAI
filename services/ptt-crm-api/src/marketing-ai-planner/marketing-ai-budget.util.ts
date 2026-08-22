import type { MktAiBrief, MktAiCampaignDraft } from './marketing-ai-planner.types';

export interface MktAiBudgetChannelMix {
  meta_pct: number;
  google_pct: number;
  content_pct: number;
  reserve_pct: number;
}

export interface MktAiBudgetScenarioDraft {
  name: string;
  slug: string;
  budget_monthly_vnd: number;
  channel_mix_json: MktAiBudgetChannelMix;
  cpl_estimates_json: Record<string, number>;
  assumptions_json: Record<string, unknown>;
  rationale_vi?: string;
  sort_order: number;
}

const LEAD_SCENARIOS: Array<{
  name: string;
  slug: string;
  mix: MktAiBudgetChannelMix;
  blended_cpl_vnd: number;
  note: string;
}> = [
  {
    name: 'Conservative',
    slug: 'conservative',
    mix: { meta_pct: 30, google_pct: 25, content_pct: 15, reserve_pct: 30 },
    blended_cpl_vnd: 220_000,
    note: 'Ưu tiên dự phòng test · CPL dự báo cao hơn',
  },
  {
    name: 'Balanced',
    slug: 'balanced',
    mix: { meta_pct: 35, google_pct: 25, content_pct: 10, reserve_pct: 30 },
    blended_cpl_vnd: 195_000,
    note: 'Cân bằng Meta + Google intent · khuyến nghị mặc định',
  },
  {
    name: 'Aggressive',
    slug: 'aggressive',
    mix: { meta_pct: 45, google_pct: 30, content_pct: 5, reserve_pct: 20 },
    blended_cpl_vnd: 240_000,
    note: 'Scale Meta/Google · CPL có thể tăng khi mở rộng',
  },
  {
    name: 'Test & Learn',
    slug: 'test_learn',
    mix: { meta_pct: 25, google_pct: 20, content_pct: 10, reserve_pct: 45 },
    blended_cpl_vnd: 210_000,
    note: 'Dành 45% dự phòng A/B test creative và landing — phù hợp giai đoạn pilot',
  },
  {
    name: 'Content-led',
    slug: 'content_led',
    mix: { meta_pct: 25, google_pct: 20, content_pct: 35, reserve_pct: 20 },
    blended_cpl_vnd: 205_000,
    note: 'Ưu tiên content/SEO nurture — CPL trung bình, lead chất lượng hơn',
  },
];

const AWARENESS_SCENARIOS: typeof LEAD_SCENARIOS = [
  {
    name: 'Conservative',
    slug: 'conservative',
    mix: { meta_pct: 25, google_pct: 15, content_pct: 35, reserve_pct: 25 },
    blended_cpl_vnd: 850,
    note: 'CPV an toàn · nhiều content/PR',
  },
  {
    name: 'Balanced',
    slug: 'balanced',
    mix: { meta_pct: 30, google_pct: 20, content_pct: 30, reserve_pct: 20 },
    blended_cpl_vnd: 780,
    note: 'Video + reach cân bằng',
  },
  {
    name: 'Aggressive',
    slug: 'aggressive',
    mix: { meta_pct: 40, google_pct: 25, content_pct: 20, reserve_pct: 15 },
    blended_cpl_vnd: 920,
    note: 'Reach tối đa trên Meta/Video',
  },
];

function scenarioTemplates(objective: string): typeof LEAD_SCENARIOS {
  if (objective === 'awareness') return AWARENESS_SCENARIOS;
  return LEAD_SCENARIOS;
}

export function buildBudgetScenarios(brief: MktAiBrief, count = 3): MktAiBudgetScenarioDraft[] {
  const objective = String(brief.objective ?? 'lead');
  const budget = Number(brief.budget_monthly_vnd ?? 0);
  const templates = scenarioTemplates(objective);
  const n = Math.min(5, Math.max(2, count));
  const picked = templates.slice(0, n);

  return picked.map((t, idx) => ({
    name: t.name,
    slug: t.slug,
    budget_monthly_vnd: budget,
    channel_mix_json: { ...t.mix },
    cpl_estimates_json: {
      blended_cpl_vnd: t.blended_cpl_vnd,
      meta_cpl_vnd: Math.round(t.blended_cpl_vnd * (objective === 'awareness' ? 1 : 0.92)),
      google_cpl_vnd: Math.round(t.blended_cpl_vnd * (objective === 'awareness' ? 1.1 : 1.08)),
    },
    assumptions_json: {
      objective,
      note: t.note,
      geo_markets: brief.geo_markets ?? [],
    },
    rationale_vi: t.note,
    sort_order: idx,
  }));
}

type ChannelBucket = keyof MktAiBudgetChannelMix;

function classifyCampaignBucket(campaign: MktAiCampaignDraft): ChannelBucket {
  const hay = `${campaign.name} ${(campaign.channel_mix ?? []).join(' ')}`.toLowerCase();
  if (/google|search|youtube|display/.test(hay)) return 'google_pct';
  if (/email|content|blog|seo|pr|tiktok|video|creative/.test(hay)) return 'content_pct';
  if (/meta|facebook|instagram|zalo|lead form|landing/.test(hay)) return 'meta_pct';
  return 'reserve_pct';
}

export function applyScenarioToCampaigns(
  campaigns: MktAiCampaignDraft[],
  mix: MktAiBudgetChannelMix,
): MktAiCampaignDraft[] {
  if (!campaigns.length) return campaigns;

  const buckets: Record<ChannelBucket, number[]> = {
    meta_pct: [],
    google_pct: [],
    content_pct: [],
    reserve_pct: [],
  };

  campaigns.forEach((c, idx) => {
    buckets[classifyCampaignBucket(c)].push(idx);
  });

  const out = campaigns.map((c) => ({ ...c }));
  for (const bucket of Object.keys(buckets) as ChannelBucket[]) {
    const indices = buckets[bucket];
    if (!indices.length) continue;
    const share = mix[bucket] / indices.length;
    for (const idx of indices) {
      out[idx].budget_pct = Math.round(share * 10) / 10;
    }
  }

  const sum = out.reduce((acc, c) => acc + c.budget_pct, 0);
  if (sum > 0 && Math.abs(sum - 100) > 0.5) {
    const factor = 100 / sum;
    for (const c of out) {
      c.budget_pct = Math.round(c.budget_pct * factor * 10) / 10;
    }
  }

  return out;
}

export function formatCplLabel(cplVnd: number, objective: string): string {
  if (objective === 'awareness') return `${Math.round(cplVnd)} CPV`;
  if (cplVnd >= 1_000_000) return `${(cplVnd / 1_000_000).toFixed(1)}M`;
  return `${Math.round(cplVnd / 1000)}k`;
}
