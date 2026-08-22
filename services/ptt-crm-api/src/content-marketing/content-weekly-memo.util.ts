import type {
  CmktContextCounts,
  CmktIntelligenceResponse,
  CmktReviewQueueSummary,
  CmktWeeklyMemoPayload,
} from './content-marketing.types';
import type { CmktMetricsRange } from './content-intelligence.util';

export function buildContentWeeklyMemo(input: {
  brandName: string;
  weekLabel: string;
  range: CmktMetricsRange;
  intelligence: CmktIntelligenceResponse;
  counts: CmktContextCounts;
  reviewSummary: CmktReviewQueueSummary;
  suggestions: string[];
  pillars: string[];
}): CmktWeeklyMemoPayload {
  const brand = input.brandName.trim() || 'Brand';
  const title = `Weekly content memo — ${brand} (${input.weekLabel})`;

  const publishBullets: string[] = [
    `Published MTD: ${input.counts.published_mtd}`,
    `Scheduled tuần này: ${input.counts.scheduled_this_week}`,
    `Metrics rows (${input.range.range}): ${input.intelligence.metrics_count}`,
  ];
  for (const [channel, stats] of Object.entries(input.intelligence.by_channel).slice(0, 5)) {
    const er =
      stats.avg_engagement != null ? ` · ER ${stats.avg_engagement}%` : '';
    publishBullets.push(
      `${channel}: ${stats.published ?? 0} published${er}${stats.external_source ? ` · ${stats.external_source}` : ''}`,
    );
  }

  const reviewBullets: string[] = [
    `In review: ${input.counts.in_review} (SLA breach: ${input.reviewSummary.sla_breach})`,
    `Draft backlog: ${input.counts.draft}`,
    `Ideas bank: ${input.counts.ideas}`,
  ];
  if (input.reviewSummary.avg_hours_in_review != null) {
    reviewBullets.push(
      `Avg hours in review: ${input.reviewSummary.avg_hours_in_review}h (target ${input.reviewSummary.sla_target_hours}h)`,
    );
  }

  const topBullets =
    input.intelligence.top_items.length > 0
      ? input.intelligence.top_items.slice(0, 5).map(
          (row) => `"${row.title}" (${row.channel} · score ${row.score})`,
        )
      : ['Chưa có top content — nhập metrics sau publish.'];

  const pillarBullets =
    input.pillars.length > 0
      ? input.pillars.slice(0, 5).map((p) => p)
      : ['Chưa có pillar từ snapshot — ingest Planner hoặc tạo thủ công.'];

  const suggestionBullets =
    input.suggestions.length > 0
      ? input.suggestions.slice(0, 5)
      : ['Chạy "Gợi ý topic tuần sau" để sinh đề xuất.'];

  const sections = [
    { heading: 'Publish & metrics', bullets: publishBullets },
    { heading: 'Review backlog', bullets: reviewBullets },
    { heading: 'Top content', bullets: topBullets },
    { heading: 'Pillars', bullets: pillarBullets },
    { heading: 'Gợi ý tuần tới', bullets: suggestionBullets },
    {
      heading: 'Governance',
      bullets: [
        'Memo chỉ tham khảo — không auto-tạo ideas (BR-AI-01).',
        'Leader xác nhận trước khi apply suggestions vào idea bank.',
      ],
    },
  ];

  const bodyParts = sections.flatMap((s) => [
    `## ${s.heading}`,
    ...s.bullets.map((b) => `- ${b}`),
    '',
  ]);

  return {
    title,
    body_vi: bodyParts.join('\n').trim(),
    sections,
    week_label: input.weekLabel,
    auto_apply: false,
  };
}
