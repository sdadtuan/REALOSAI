import { TARGET_MARKET_PROF_KEYS } from '../service-lifecycle/lifecycle-marketing-plan.util';
import type { MktAiCampaignDraft, MktAiCitation } from './marketing-ai-planner.types';
import { STRATEGY_FRAMEWORK_KEYS } from './marketing-ai-prompts';

export interface MktAiStrategyOutput {
  strategy_framework: Record<string, string>;
  target_market_prof: Record<string, string>;
  swot_json: Record<string, string[]>;
  rag_citations?: Record<string, MktAiCitation[]>;
}

export interface MktAiContentOutput {
  content_json: Record<string, unknown>;
  assets: Array<{
    asset_type: string;
    title: string;
    body_text: string;
    scheduled_date: string | null;
    channel: string;
    content_json: Record<string, unknown>;
  }>;
}

function str(v: unknown, fallback: string): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return fallback;
}

function arrStr(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const items = v.map((x) => String(x).trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function pickStringRecord(
  raw: unknown,
  keys: readonly string[],
  fallback: Record<string, string>,
): Record<string, string> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = { ...fallback };
  for (const key of keys) {
    const v = src[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

export function normalizeSwot(
  raw: unknown,
  fallback: Record<string, string[]>,
): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return fallback;
  const src = raw as Record<string, unknown>;
  const pickArr = (k: string, fb: string[]) => {
    const v = src[k];
    if (Array.isArray(v)) {
      const items = v.map((x) => String(x).trim()).filter(Boolean);
      return items.length ? items : fb;
    }
    return fb;
  };
  return {
    strengths: pickArr('strengths', fallback.strengths ?? []),
    weaknesses: pickArr('weaknesses', fallback.weaknesses ?? []),
    opportunities: pickArr('opportunities', fallback.opportunities ?? []),
    threats: pickArr('threats', fallback.threats ?? []),
  };
}

export function normalizeStrategyOutput(
  raw: Record<string, unknown>,
  fallback: MktAiStrategyOutput,
): MktAiStrategyOutput {
  const ragRaw = raw.rag_citations;
  const rag_citations =
    ragRaw && typeof ragRaw === 'object'
      ? (ragRaw as MktAiStrategyOutput['rag_citations'])
      : fallback.rag_citations;
  return {
    strategy_framework: pickStringRecord(
      raw.strategy_framework,
      STRATEGY_FRAMEWORK_KEYS,
      fallback.strategy_framework,
    ),
    target_market_prof: pickStringRecord(
      raw.target_market_prof,
      TARGET_MARKET_PROF_KEYS,
      fallback.target_market_prof,
    ),
    swot_json: normalizeSwot(raw.swot_json, fallback.swot_json),
    rag_citations,
  };
}

function normalizeOneCampaign(item: unknown, fb: MktAiCampaignDraft): MktAiCampaignDraft {
  if (!item || typeof item !== 'object') return fb;
  const c = item as Record<string, unknown>;
  return {
    name: str(c.name, fb.name),
    objective: str(c.objective, fb.objective),
    channel_mix: arrStr(c.channel_mix, fb.channel_mix),
    budget_pct: num(c.budget_pct, fb.budget_pct),
    timeline_weeks: str(c.timeline_weeks, fb.timeline_weeks ?? 'W1–W4'),
    milestones: arrStr(c.milestones, fb.milestones ?? []),
    kpis: arrStr(c.kpis, fb.kpis ?? []),
  };
}

export function normalizeCampaignsOutput(
  raw: Record<string, unknown>,
  fallback: MktAiCampaignDraft[],
): MktAiCampaignDraft[] {
  const list = raw.campaigns ?? raw.campaigns_json;
  if (!Array.isArray(list) || !list.length) return fallback;
  const normalized = list.map((item, idx) =>
    normalizeOneCampaign(item, fallback[idx] ?? fallback[0]),
  );
  return normalized.length ? normalized : fallback;
}

function normalizeAsset(
  item: unknown,
  fb: MktAiContentOutput['assets'][0],
): MktAiContentOutput['assets'][0] {
  if (!item || typeof item !== 'object') return fb;
  const a = item as Record<string, unknown>;
  const cj =
    a.content_json && typeof a.content_json === 'object'
      ? (a.content_json as Record<string, unknown>)
      : fb.content_json;
  return {
    asset_type: str(a.asset_type, fb.asset_type),
    title: str(a.title, fb.title),
    body_text: str(a.body_text, fb.body_text),
    scheduled_date:
      typeof a.scheduled_date === 'string' ? a.scheduled_date : fb.scheduled_date,
    channel: str(a.channel, fb.channel),
    content_json: cj,
  };
}

export function normalizeContentOutput(
  raw: Record<string, unknown>,
  fallback: MktAiContentOutput,
): MktAiContentOutput {
  const rawCj =
    raw.content_json && typeof raw.content_json === 'object'
      ? (raw.content_json as Record<string, unknown>)
      : null;
  const content_json = rawCj ? { ...fallback.content_json, ...rawCj } : fallback.content_json;

  if (Array.isArray(raw.assets) && raw.assets.length) {
    const assets = raw.assets.map((item, idx) =>
      normalizeAsset(item, fallback.assets[idx] ?? fallback.assets[0]),
    );
    return { content_json, assets };
  }
  return { content_json, assets: fallback.assets };
}
