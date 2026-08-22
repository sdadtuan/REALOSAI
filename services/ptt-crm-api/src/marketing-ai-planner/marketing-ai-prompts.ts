import type { MktAiBrief, MktAiCampaignDraft } from './marketing-ai-planner.types';

export const MKT_AI_PROMPT_VERSION = 'v1-kit-port';

/** Ported from marketing_campaign_kit.py OBJECTIVE_CHANNELS */
export const OBJECTIVE_CHANNELS: Record<
  string,
  Array<{ name: string; goal: string; kpi: string; budget_pct: number }>
> = {
  lead: [
    { name: 'Google Search', goal: 'Conversion', kpi: 'CPL ≤250k', budget_pct: 35 },
    { name: 'Meta Ads', goal: 'Lead form', kpi: 'CPL ≤180k', budget_pct: 25 },
    { name: 'LinkedIn', goal: 'B2B Lead', kpi: 'CPL ≤350k', budget_pct: 15 },
    { name: 'Email/CRM', goal: 'Nurture', kpi: 'Open ≥25%', budget_pct: 5 },
    { name: 'Landing/CRO', goal: 'Conversion', kpi: 'CVR ≥4%', budget_pct: 5 },
    { name: 'Telesales', goal: 'SQL', kpi: 'Contact ≥60%', budget_pct: 0 },
    { name: 'Dự phòng', goal: 'Test', kpi: '—', budget_pct: 15 },
  ],
  awareness: [
    { name: 'TikTok/Video', goal: 'Awareness', kpi: 'CPV ≤800', budget_pct: 30 },
    { name: 'Meta Reach', goal: 'Reach', kpi: 'CPM, Freq ≤3', budget_pct: 25 },
    { name: 'YouTube', goal: 'Consideration', kpi: 'VTR ≥25%', budget_pct: 20 },
    { name: 'PR/Content', goal: 'SOV', kpi: 'Branded search +15%', budget_pct: 15 },
    { name: 'Google Display', goal: 'Remarketing', kpi: 'CTR ≥0.5%', budget_pct: 5 },
    { name: 'Dự phòng', goal: 'Test', kpi: '—', budget_pct: 5 },
  ],
  retention: [
    { name: 'Email/CRM', goal: 'Retention', kpi: 'Churn ≤5%', budget_pct: 35 },
    { name: 'In-app/SMS', goal: 'Activation', kpi: 'DAU/MAU', budget_pct: 20 },
    { name: 'Meta Retarget', goal: 'Upsell', kpi: 'ROAS ≥4', budget_pct: 20 },
    { name: 'CS/NPS', goal: 'Advocacy', kpi: 'NPS ≥40', budget_pct: 10 },
    { name: 'Referral', goal: 'Growth', kpi: 'Referral rate', budget_pct: 10 },
    { name: 'Dự phòng', goal: 'Test', kpi: '—', budget_pct: 5 },
  ],
};

export const STRATEGY_FRAMEWORK_KEYS = [
  'target_market',
  'market_message',
  'media_reach',
  'conversion_strategy',
  'retention_system',
  'nurture_system',
] as const;

function formatBudgetVnd(vnd: number | undefined): string {
  const n = Number(vnd ?? 0);
  if (!n) return 'chưa xác định';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ VNĐ/tháng`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M VNĐ/tháng`;
  return `${n.toLocaleString('vi-VN')} VNĐ/tháng`;
}

export function buildBriefContextBlock(brief: MktAiBrief): string {
  const lines = [
    `- Thương hiệu: ${brief.brand_name ?? '(chưa có)'}`,
    `- Ngành: ${brief.industry ?? '(chưa có)'}`,
    `- Dịch vụ: ${brief.service_slug ?? '(chưa có)'}`,
    `- Mục tiêu: ${brief.objective ?? 'lead'}`,
    `- Ngân sách tháng: ${formatBudgetVnd(brief.budget_monthly_vnd)}`,
    `- Thị trường địa lý: ${(brief.geo_markets ?? []).join(', ') || 'Việt Nam'}`,
    `- USP: ${brief.usp ?? '(chưa có)'}`,
    `- Thách thức / pain: ${brief.challenges ?? '(chưa có)'}`,
    `- Đối thủ: ${(brief.competitors ?? []).join(', ') || '(chưa có)'}`,
    `- Website: ${brief.website_url ?? '(chưa có)'}`,
    `- Timeline: ${brief.timeline_start ?? '?'} → ${brief.timeline_end ?? '?'}`,
    `- Ghi chú: ${brief.notes ?? '(không)'}`,
  ];
  return lines.join('\n');
}

function objectiveChannelHint(objective: string): string {
  const channels = OBJECTIVE_CHANNELS[objective] ?? OBJECTIVE_CHANNELS.lead;
  return channels
    .map((c) => `${c.name} (${c.goal}, KPI: ${c.kpi}, ~${c.budget_pct}%)`)
    .join('; ');
}

export const MKT_AI_STRATEGY_SYSTEM = `Bạn là chuyên gia chiến lược marketing B2B/B2C tại Việt Nam (PTT Ads).
Trả lời bằng JSON hợp lệ (response_format json_object), ngôn ngữ tiếng Việt, súc tích, actionable.

Schema bắt buộc:
{
  "strategy_framework": {
    "target_market": string,
    "market_message": string,
    "media_reach": string,
    "conversion_strategy": string,
    "retention_system": string,
    "nurture_system": string
  },
  "target_market_prof": {
    "market_context": string,
    "tam_sam_som": string,
    "geo_behavior": string,
    "segmentation_icp": string,
    "personas_roles": string,
    "jobs_to_be_done": string,
    "pains_desired_outcomes": string,
    "buy_triggers_obstacles": string,
    "criteria_vs_alternatives": string,
    "insights_evidence": string,
    "segment_priorities": string,
    "success_hypotheses_next": string
  },
  "swot_json": {
    "strengths": string[],
    "weaknesses": string[],
    "opportunities": string[],
    "threats": string[]
  }
}

Quy tắc:
- Mỗi trường strategy_framework ≤280 ký tự; target_market_prof ≤400 ký tự.
- media_reach phải phản ánh phân bổ kênh theo mục tiêu (lead/awareness/retention).
- SWOT mỗi mảng 2–4 bullet ngắn.
- Không thêm key ngoài schema.`;

export function buildStrategyUserPrompt(
  brief: MktAiBrief,
  ragBlock?: string,
  playbookBlock?: string,
): string {
  const objective = String(brief.objective ?? 'lead');
  const parts = [
    'Tạo chiến lược marketing từ brief sau:',
    '',
    buildBriefContextBlock(brief),
    '',
    `Gợi ý kênh theo mục tiêu "${objective}": ${objectiveChannelHint(objective)}`,
    '',
    'Áp dụng framework 6T (target_market, market_message, media_reach, conversion, retention, nurture) và TMMT 12 mục.',
  ];
  if (playbookBlock?.trim()) {
    parts.push('', playbookBlock.trim());
  }
  if (ragBlock?.trim()) {
    parts.push('', ragBlock.trim());
  }
  return parts.join('\n');
}

export const MKT_AI_CAMPAIGN_SYSTEM = `Bạn là planner chiến dịch marketing tại Việt Nam.
Trả lời JSON hợp lệ với schema:
{
  "campaigns": [
    {
      "name": string,
      "objective": "lead" | "awareness" | "sales" | "retention" | string,
      "channel_mix": string[],
      "budget_pct": number,
      "timeline_weeks": string,
      "milestones": string[],
      "kpis": string[]
    }
  ]
}

Quy tắc:
- 2–4 chiến dịch; tổng budget_pct ≈ 100 (±5).
- KPI cụ thể (CPL, CTR, CVR, ROAS…) bằng tiếng Việt.
- timeline_weeks dạng "W1–W4".
- milestones 3–5 bước thực thi.`;

export function buildCampaignUserPrompt(brief: MktAiBrief, playbookBlock?: string): string {
  const objective = String(brief.objective ?? 'lead');
  const channels = OBJECTIVE_CHANNELS[objective] ?? OBJECTIVE_CHANNELS.lead;
  const channelTable = channels
    .map((c) => `| ${c.name} | ${c.goal} | ${c.kpi} | ${c.budget_pct}% |`)
    .join('\n');
  const parts = [
    'Thiết kế bộ chiến dịch từ brief:',
    '',
    buildBriefContextBlock(brief),
    '',
    'Tham chiếu media mix (marketing_campaign_kit):',
    '| Kênh | Goal | KPI | Budget % |',
    channelTable,
  ];
  if (playbookBlock?.trim()) {
    parts.push('', playbookBlock.trim());
  }
  parts.push('', 'Mỗi campaign gắn với 1–2 kênh trọng tâm; có milestone launch → optimize.');
  return parts.join('\n');
}

export const MKT_AI_CONTENT_SYSTEM = `Bạn là content strategist marketing Việt Nam.
Trả lời JSON hợp lệ:
{
  "content_json": {
    "calendar": [{ "date": "YYYY-MM-DD", "type": string, "channel": string, "copy": string }],
    "ad_copy": [{ "variant": string, "headline": string, "body": string, "cta": string }],
    "email_sequence": string[]
  },
  "assets": [
    {
      "asset_type": "social_post" | "blog" | "email_sequence" | string,
      "title": string,
      "body_text": string,
      "scheduled_date": "YYYY-MM-DD" | null,
      "channel": string,
      "content_json": object
    }
  ]
}

Quy tắc:
- calendar 8–12 mục trong 4 tuần tới; ad_copy ≥1 variant/campaign; email_sequence 3–5 touch.
- Copy tiếng Việt, CTA rõ ràng; assets mirror calendar (≤8 mục đầu).`;

export function buildContentUserPrompt(
  brief: MktAiBrief,
  campaigns: MktAiCampaignDraft[],
): string {
  const campaignLines =
    campaigns.length === 0
      ? '(chưa có chiến dịch — tạo nội dung generic theo brief)'
      : campaigns
          .map(
            (c, i) =>
              `${i + 1}. ${c.name} [${c.objective}] — ${(c.channel_mix ?? []).join('+')} — KPI: ${(c.kpis ?? []).join(', ')}`,
          )
          .join('\n');
  return [
    'Tạo lịch nội dung + ad copy + email nurture:',
    '',
    buildBriefContextBlock(brief),
    '',
    'Chiến dịch đã chốt:',
    campaignLines,
  ].join('\n');
}

export const MKT_AI_OPTIMIZE_SYSTEM = `Bạn là optimization copilot marketing tại Việt Nam (PTT Ads).
Trả lời JSON hợp lệ (response_format json_object), tiếng Việt, actionable.

Schema:
{
  "recommendations": [
    {
      "id": string,
      "title": string,
      "rationale": string,
      "priority": "high" | "medium" | "low",
      "suggested_task": {
        "stage": "deliver" | "retain" | string,
        "title": string,
        "description": string
      }
    }
  ]
}

Quy tắc (BR-MKTP-01):
- 3–5 đề xuất tối đa; KHÔNG auto thay đổi campaign Meta/Google qua API.
- Chỉ đề xuất hành động con người thực hiện (audience, creative, landing, pacing).
- CPL lệch >15% → ưu tiên high: thu hẹp audience, refresh creative, review landing.
- ROAS stub → ghi rõ trong rationale.
- suggested_task.stage ∈ {deliver, retain} theo lifecycle.`;

export function buildOptimizeUserPrompt(input: {
  dashboard: {
    tiles: { spend_mtd_vnd: number; leads_mtd: number; cpl_mtd: number | null; roas_mtd: number | null; roas_stub: boolean };
    deltas: { cpl_vs_target_pct: number | null; spend_vs_prev_week_pct: number | null };
    targets: { cpl_vnd: number | null };
    linked: boolean;
  };
  brief: MktAiBrief | null;
  campaigns: MktAiCampaignDraft[];
  lifecycleStage: string;
}): string {
  const { dashboard: d, brief, campaigns, lifecycleStage } = input;
  const campaignLines =
    campaigns.length === 0
      ? '(chưa có draft campaigns)'
      : campaigns
          .map((c) => `- ${c.name}: ${(c.kpis ?? []).join(', ')}`)
          .join('\n');

  const parts = [
    `Lifecycle stage: ${lifecycleStage}`,
    `Linked performance: ${d.linked ? 'yes' : 'no'}`,
    '',
    'KPI snapshot:',
    `- Spend MTD: ${d.tiles.spend_mtd_vnd.toLocaleString('vi-VN')} VNĐ`,
    `- Leads MTD: ${d.tiles.leads_mtd}`,
    `- CPL MTD: ${d.tiles.cpl_mtd ?? 'n/a'}`,
    `- CPL vs target: ${d.deltas.cpl_vs_target_pct != null ? `${d.deltas.cpl_vs_target_pct}%` : 'n/a'}`,
    `- Target CPL: ${d.targets.cpl_vnd != null ? d.targets.cpl_vnd.toLocaleString('vi-VN') : 'n/a'}`,
    `- Spend vs prev week: ${d.deltas.spend_vs_prev_week_pct != null ? `${d.deltas.spend_vs_prev_week_pct}%` : 'n/a'}`,
    `- ROAS: ${d.tiles.roas_mtd ?? 'n/a'}${d.tiles.roas_stub ? ' (stub)' : ''}`,
    '',
    'Draft campaigns:',
    campaignLines,
  ];

  if (brief) {
    parts.push('', 'Brief context:', buildBriefContextBlock(brief));
  }

  parts.push('', 'Đề xuất 3–5 hành động optimize; mỗi item có suggested_task để AM tạo task lifecycle.');
  return parts.join('\n');
}

/** User-facing brief checklist (from KPI_BRIEF_PROMPT in marketing_campaign_kit.py) */
export const MKT_AI_BRIEF_CHECKLIST_HINT =
  'Brief cần: tên dự án, mục tiêu (lead/awareness/retention), ICP, timeline, ngân sách, kênh ưu tiên.';
