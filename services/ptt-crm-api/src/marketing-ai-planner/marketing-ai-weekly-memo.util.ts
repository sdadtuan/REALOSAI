import type {
  MktAiKpiClosedLoopPayload,
  MktAiOptimizeRecommendation,
  MktAiWeeklyMemoPayload,
} from './marketing-ai-planner.types';

export function buildWeeklyOptimizationMemo(input: {
  brandLabel: string;
  weekLabel: string;
  closedLoop: MktAiKpiClosedLoopPayload;
  recommendations: MktAiOptimizeRecommendation[];
}): MktAiWeeklyMemoPayload {
  const brand = input.brandLabel.trim() || 'Lifecycle';
  const title = `Weekly optimization memo — ${brand} (${input.weekLabel})`;

  const kpiBullets: string[] = [];
  if (!input.closedLoop.has_applied_kpi_tree) {
    kpiBullets.push('Chưa có KPI tree đã Apply — hoàn thiện KPI tree và Apply TMMT trước khi đối chiếu.');
  } else if (input.closedLoop.rows.length === 0) {
    kpiBullets.push('KPI tree đã Apply nhưng thiếu target số — cập nhật target trên từng node.');
  } else {
    for (const row of input.closedLoop.rows) {
      const delta =
        row.delta_pct != null ? ` (${row.delta_pct > 0 ? '+' : ''}${row.delta_pct}%)` : '';
      kpiBullets.push(
        `${row.label}: Target ${row.target_display} · Actual ${row.actual_display}${delta}${row.alert ? ' ⚠' : ''}`,
      );
    }
  }

  const alertBullets =
    input.closedLoop.alerts.length > 0
      ? input.closedLoop.alerts.map(
          (a) => `${a.label} lệch ngưỡng — ưu tiên action tuần này (${a.metric_kind}).`,
        )
      : ['KPI trong ngưỡng — duy trì cadence review hàng tuần.'];

  const actionBullets =
    input.recommendations.length > 0
      ? input.recommendations.slice(0, 5).map((r) => `[${r.priority}] ${r.title}: ${r.rationale}`)
      : ['Chạy Optimize copilot để nhận đề xuất cụ thể theo dashboard.'];

  const sections = [
    { heading: 'KPI plan vs actual', bullets: kpiBullets },
    { heading: 'Cảnh báo', bullets: alertBullets },
    { heading: 'Đề xuất tuần tới', bullets: actionBullets },
    {
      heading: 'Governance',
      bullets: [
        'Memo này chỉ tham khảo — không auto-Apply TMMT (BR-MKTP-01).',
        'SP xác nhận thủ công trước khi chỉnh chiến lược / campaign.',
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
