import { createHash } from 'crypto';

export type PlannerIngestSource = {
  marketing_plan_id: number;
  brief_json: Record<string, unknown>;
  content_json: Record<string, unknown>;
  campaigns_json: unknown[];
  strategy_framework_json: Record<string, unknown>;
  target_market_prof_json: Record<string, unknown>;
};

export type SnapshotPillarDraft = {
  name: string;
  goal: string;
  topics: string[];
  sort_order: number;
};

export type SnapshotIdeaDraft = {
  title: string;
  hook: string;
  target_goal: string;
  channel_hints: string[];
  meta_json: Record<string, unknown>;
};

export type SnapshotJson = {
  marketing_plan_id: number;
  applied_at: string;
  pillars: SnapshotPillarDraft[];
  calendar: Array<Record<string, unknown>>;
  campaigns: unknown[];
  kpi_excerpt: Record<string, unknown>;
};

export function computePlannerSourceHash(source: PlannerIngestSource): string {
  const payload = JSON.stringify({
    marketing_plan_id: source.marketing_plan_id,
    content_json: source.content_json,
    campaigns_json: source.campaigns_json,
    strategy_framework_json: source.strategy_framework_json,
    brief_json: {
      brand_name: source.brief_json.brand_name,
      objective: source.brief_json.objective,
      usp: source.brief_json.usp,
    },
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function buildSnapshotJson(source: PlannerIngestSource): SnapshotJson {
  const pillars = extractPillarsFromPlanner(source);
  const calendar = extractCalendarRows(source.content_json);
  return {
    marketing_plan_id: source.marketing_plan_id,
    applied_at: new Date().toISOString(),
    pillars,
    calendar,
    campaigns: source.campaigns_json ?? [],
    kpi_excerpt: {
      objective: String(source.brief_json.objective ?? ''),
      brand_name: String(source.brief_json.brand_name ?? ''),
    },
  };
}

export function extractCalendarRows(contentJson: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = contentJson.calendar ?? contentJson;
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      date: r.date ?? r.scheduled_at ?? '',
      week: r.week ?? null,
      title: r.title ?? '',
      type: r.type ?? r.format ?? '',
      channel: r.channel ?? '',
      goal: r.goal ?? r.target_goal ?? '',
      copy: r.copy ?? r.hook ?? '',
    };
  });
}

export function extractPillarsFromPlanner(source: PlannerIngestSource): SnapshotPillarDraft[] {
  const content = source.content_json ?? {};
  const explicit = content.pillars;
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map((row, idx) => {
      const r = row as Record<string, unknown>;
      return {
        name: String(r.name ?? `Pillar ${idx + 1}`),
        goal: String(r.goal ?? 'awareness'),
        topics: Array.isArray(r.topics) ? r.topics.map((t) => String(t)) : [],
        sort_order: idx,
      };
    });
  }

  const sf = source.strategy_framework_json ?? {};
  const keys = ['positioning', 'messaging_pillars', 'content_themes', 'value_proposition'];
  const pillars: SnapshotPillarDraft[] = [];
  for (const key of keys) {
    const val = sf[key];
    if (typeof val === 'string' && val.trim()) {
      pillars.push({
        name: key.replace(/_/g, ' '),
        goal: 'awareness',
        topics: [val.trim()],
        sort_order: pillars.length,
      });
    }
  }

  if (Array.isArray(source.campaigns_json) && source.campaigns_json.length) {
    for (const [idx, camp] of source.campaigns_json.entries()) {
      const c = camp as Record<string, unknown>;
      const name = String(c.name ?? '').trim();
      if (!name) continue;
      pillars.push({
        name,
        goal: String(c.objective ?? 'lead'),
        topics: Array.isArray(c.kpis) ? c.kpis.map((k) => String(k)) : [],
        sort_order: pillars.length || idx,
      });
    }
  }

  if (!pillars.length) {
    pillars.push({
      name: 'Content plan',
      goal: String(source.brief_json.objective ?? 'awareness'),
      topics: source.brief_json.usp ? [String(source.brief_json.usp)] : [],
      sort_order: 0,
    });
  }

  return pillars;
}

/** Map Planner calendar row → CMKT channel hints (not items). */
export function mapPlannerRowToChannelHints(
  type: string,
  channel: string,
): string[] {
  const mapped = mapPlannerChannelFormat(type, channel);
  if (mapped) return [mapped.channel];
  const ch = channel.toLowerCase();
  if (ch.includes('linkedin')) return ['linkedin'];
  if (ch.includes('facebook') || ch.includes('meta')) return ['facebook'];
  if (ch.includes('email')) return ['newsletter'];
  if (type === 'blog') return ['website'];
  return [];
}

export function mapPlannerChannelFormat(
  type: string,
  channel: string,
): { channel: string; format: string } | null {
  const t = type.toLowerCase().trim();
  const ch = channel.toLowerCase().trim();

  if (t === 'blog' || t === 'long') return { channel: 'website', format: 'blog' };
  if (t === 'carousel') {
    if (ch.includes('linkedin')) return { channel: 'linkedin', format: 'carousel' };
    return { channel: 'facebook', format: 'carousel' };
  }
  if (t === 'social_post' || t === 'social') {
    if (ch.includes('linkedin')) return { channel: 'linkedin', format: 'social_post' };
    return { channel: 'facebook', format: 'social_post' };
  }
  if (t === 'email' || t === 'email_sequence') return { channel: 'newsletter', format: 'email' };
  if (t === 'video_script' || t === 'short_video') return { channel: 'short_video', format: 'video_script' };
  if (t === 'ad_copy') {
    if (ch.includes('google')) return { channel: 'google_ads', format: 'ad_copy' };
    return { channel: 'meta_ads', format: 'ad_copy' };
  }

  if (ch.includes('website') || ch.includes('blog')) return { channel: 'website', format: 'blog' };
  if (ch.includes('linkedin')) return { channel: 'linkedin', format: 'social_post' };
  if (ch.includes('facebook') || ch.includes('meta')) return { channel: 'facebook', format: 'social_post' };
  if (ch.includes('email')) return { channel: 'newsletter', format: 'email' };

  return null;
}

export function extractIdeasFromPlanner(
  source: PlannerIngestSource,
  opts: { importCalendar: boolean },
): SnapshotIdeaDraft[] {
  if (!opts.importCalendar) return [];
  const ideas: SnapshotIdeaDraft[] = [];
  const seen = new Set<string>();

  for (const row of extractCalendarRows(source.content_json)) {
    const title = String(row.title ?? '').trim() || String(row.copy ?? '').trim().slice(0, 120);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const type = String(row.type ?? '');
    const channel = String(row.channel ?? '');
    const hints = mapPlannerRowToChannelHints(type, channel);
    const mapped = mapPlannerChannelFormat(type, channel);

    ideas.push({
      title,
      hook: String(row.copy ?? '').trim().slice(0, 280),
      target_goal: String(row.goal ?? 'engagement'),
      channel_hints: hints,
      meta_json: {
        planner_row: row,
        suggested_channel: mapped?.channel ?? null,
        suggested_format: mapped?.format ?? null,
        source: 'planner_calendar',
      },
    });
  }

  const adCopy = source.content_json.ad_copy;
  if (Array.isArray(adCopy)) {
    for (const [idx, row] of adCopy.entries()) {
      const r = row as Record<string, unknown>;
      const headline = String(r.headline ?? r.title ?? '').trim();
      if (!headline) continue;
      const key = `ad:${headline.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ideas.push({
        title: headline,
        hook: String(r.body ?? '').trim().slice(0, 280),
        target_goal: 'conversion',
        channel_hints: ['meta_ads'],
        meta_json: { source: 'planner_ad_copy', variant: r.variant ?? idx + 1 },
      });
    }
  }

  return ideas;
}

export function buildBrandContextJson(brief: Record<string, unknown>): Record<string, unknown> {
  return {
    brand_name: brief.brand_name ?? '',
    industry: brief.industry ?? '',
    objective: brief.objective ?? '',
    usp: brief.usp ?? '',
    tone: brief.tone ?? 'professional_friendly',
    audience: brief.geo_markets ?? brief.target_audience ?? [],
    website_url: brief.website_url ?? '',
  };
}

export function normalizeIdeaTitle(title: string): string {
  return title.trim().toLowerCase();
}
