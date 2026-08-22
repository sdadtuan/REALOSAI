import {
  BRIEF_FIELD_LABELS,
  type MktAiBrief,
  type MktAiBriefValidation,
  type MktAiKpiTreeNode,
  REQUIRED_BRIEF_FIELDS,
} from './marketing-ai-planner.types';

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value) || value <= 0;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0 || value.every((x) => !String(x).trim());
  return false;
}

export function validateMktAiBrief(brief: MktAiBrief | null | undefined): MktAiBriefValidation {
  const missing: string[] = [];
  const messages: string[] = [];
  const b = brief ?? {};
  for (const key of REQUIRED_BRIEF_FIELDS) {
    const val = b[key as keyof MktAiBrief];
    if (isEmpty(val)) {
      missing.push(key);
      messages.push(`Điền ${BRIEF_FIELD_LABELS[key] ?? key}.`);
    }
  }
  return { ok: missing.length === 0, missing, messages };
}

export function mergeBrief(existing: MktAiBrief | null, patch: Record<string, unknown>): MktAiBrief {
  const out: MktAiBrief = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === 'geo_markets' || key === 'competitors') {
      out[key] = Array.isArray(value)
        ? value.map((x) => String(x).trim()).filter(Boolean)
        : String(value ?? '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
      continue;
    }
    if (key === 'budget_monthly_vnd') {
      const n = Number(value);
      out.budget_monthly_vnd = Number.isFinite(n) ? n : undefined;
      continue;
    }
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function emptyDraft(): {
  strategy_framework: Record<string, string>;
  target_market_prof: Record<string, string>;
  swot_json: Record<string, unknown>;
  campaigns_json: unknown[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
  kpi_tree_json: MktAiKpiTreeNode[];
  kpi_tree_applied_json: MktAiKpiTreeNode[];
} {
  return {
    strategy_framework: {},
    target_market_prof: {},
    swot_json: {},
    campaigns_json: [],
    content_json: {},
    quality_score_json: {},
    kpi_tree_json: [],
    kpi_tree_applied_json: [],
  };
}
