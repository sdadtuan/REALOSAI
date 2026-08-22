import type {
  CmktExternalMetricsSummary,
  CmktIntelligenceChannelStats,
  CmktIntelligenceResponse,
  CmktMetricWithItemRow,
  CmktMetricsSummaryResponse,
} from './content-marketing.types';

export type CmktMetricsRange = {
  range: string;
  fromDate: string;
  toDate: string;
  days: number;
};

export function parseMetricsRange(input?: string | null): CmktMetricsRange {
  const raw = String(input ?? '30d').trim().toLowerCase() || '30d';
  const match = /^(\d+)d$/.exec(raw);
  const days = match ? Math.min(Math.max(Number(match[1]), 1), 365) : 30;
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    range: `${days}d`,
    fromDate: formatDate(from),
    toDate: formatDate(to),
    days,
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function num(value: number | null | undefined): number {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : 0;
}

function engagementRate(engagements: number, impressions: number): number | undefined {
  if (impressions <= 0) return undefined;
  return Math.round((engagements / impressions) * 1000) / 10;
}

export function scoreMetricRow(row: CmktMetricWithItemRow): number {
  const impressions = num(row.impressions);
  const engagements = num(row.engagements);
  const clicks = num(row.clicks);
  const leads = num(row.leads);
  const rate = impressions > 0 ? engagements / impressions : 0;
  return Math.round(leads * 100 + clicks * 10 + engagements + rate * 500);
}

export function aggregateIntelligence(
  rows: CmktMetricWithItemRow[],
  range: CmktMetricsRange,
  publishedByChannel: Record<string, number>,
  suggestions: string[] = [],
): CmktIntelligenceResponse {
  const by_channel: Record<string, CmktIntelligenceChannelStats> = {};
  for (const [channel, published] of Object.entries(publishedByChannel)) {
    by_channel[channel] = { published };
  }

  for (const row of rows) {
    const channel = row.channel || 'unknown';
    const bucket = by_channel[channel] ?? { published: publishedByChannel[channel] ?? 0 };
    bucket.impressions = num(bucket.impressions) + num(row.impressions);
    bucket.engagements = num(bucket.engagements) + num(row.engagements);
    bucket.clicks = num(bucket.clicks) + num(row.clicks);
    bucket.leads = num(bucket.leads) + num(row.leads);
    bucket.avg_engagement = engagementRate(num(bucket.engagements), num(bucket.impressions));
    by_channel[channel] = bucket;
  }

  const itemScores = new Map<number, { title: string; channel: string; score: number }>();
  for (const row of rows) {
    const prev = itemScores.get(row.item_id);
    const delta = scoreMetricRow(row);
    if (prev) {
      prev.score += delta;
    } else {
      itemScores.set(row.item_id, {
        title: row.item_title,
        channel: row.channel,
        score: delta,
      });
    }
  }

  const top_items = [...itemScores.entries()]
    .map(([item_id, meta]) => ({
      item_id,
      title: meta.title,
      channel: meta.channel,
      score: meta.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    range: range.range,
    from_date: range.fromDate,
    to_date: range.toDate,
    by_channel,
    top_items,
    suggestions,
    metrics_count: rows.length,
  };
}

export function summarizeMetrics(
  rows: CmktMetricWithItemRow[],
  range: CmktMetricsRange,
  publishedByChannel: Record<string, number>,
): CmktMetricsSummaryResponse {
  const intel = aggregateIntelligence(rows, range, publishedByChannel);
  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += num(row.impressions);
      acc.engagements += num(row.engagements);
      acc.clicks += num(row.clicks);
      acc.leads += num(row.leads);
      return acc;
    },
    { impressions: 0, engagements: 0, clicks: 0, leads: 0 },
  );
  return {
    range: intel.range,
    from_date: intel.from_date,
    to_date: intel.to_date,
    totals,
    by_channel: intel.by_channel,
    entries_count: rows.length,
  };
}

export function mergeExternalIntoChannels(
  by_channel: Record<string, CmktIntelligenceChannelStats>,
  external: CmktExternalMetricsSummary,
): Record<string, CmktIntelligenceChannelStats> {
  if (!external.enabled) return by_channel;
  const merged: Record<string, CmktIntelligenceChannelStats> = { ...by_channel };
  for (const [channel, ext] of Object.entries(external.by_channel)) {
    const existing = merged[channel] ?? { published: 0 };
    merged[channel] = {
      ...existing,
      external_source: ext.source,
      external_metrics: ext,
    };
  }
  return merged;
}

export function buildTopicSuggestions(input: {
  intelligence: CmktIntelligenceResponse;
  pillarNames: string[];
  brandName: string;
  channelHints?: string[];
}): string[] {
  const topChannels = Object.entries(input.intelligence.by_channel)
    .sort((a, b) => num(b[1].engagements) - num(a[1].engagements))
    .map(([channel]) => channel)
    .slice(0, 3);
  const topItems = input.intelligence.top_items.slice(0, 3).map((i) => i.title);
  const pillars = input.pillarNames.slice(0, 3);
  const hints = input.channelHints?.slice(0, 2) ?? topChannels;

  const out: string[] = [];
  if (pillars.length) {
    out.push(`Double-down pillar "${pillars[0]}" với format carousel trên ${hints[0] ?? 'facebook'}.`);
  }
  if (topItems.length) {
    out.push(`Repurpose chủ đề tương tự "${topItems[0]}" sang kênh underperform.`);
  }
  if (topChannels.length >= 2) {
    out.push(`So sánh A/B hook giữa ${topChannels[0]} và ${topChannels[1]} tuần tới.`);
  }
  out.push(`Chuỗi ${input.brandName}: 3 bài educational + 1 CTA lead magnet.`);
  out.push('Thu thập metrics sau 48h publish để cập nhật intelligence.');
  return out.slice(0, 6);
}
