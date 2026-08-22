import { BRIEF_FIELD_LABELS } from './marketing-ai-planner.types';
import type { MktAiBrief, MktAiCampaignDraft, MktAiDraft } from './marketing-ai-planner.types';
import { EXPORT_STRATEGY_LABELS, EXPORT_TMMT_LABELS } from './marketing-ai-export-labels';
import type { ContentCalendarRow, MktAiExportDocument, MktAiExportSection } from './marketing-ai-export.types';
import { normalizeCalendar, normalizeCampaigns } from './marketing-ai-export.types';

function fmtVnd(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(v) + ' VND';
}

function briefLines(brief: MktAiBrief | null): string[] {
  if (!brief) return ['(Chưa có brief)'];
  const lines: string[] = [];
  for (const [key, label] of Object.entries(BRIEF_FIELD_LABELS)) {
    const raw = (brief as Record<string, unknown>)[key];
    if (raw == null || raw === '') continue;
    const val = Array.isArray(raw) ? raw.join(', ') : String(raw);
    lines.push(`${label}: ${key === 'budget_monthly_vnd' ? fmtVnd(raw) : val}`);
  }
  if (brief.competitors?.length) lines.push(`Đối thủ: ${brief.competitors.join(', ')}`);
  if (brief.usp) lines.push(`USP: ${brief.usp}`);
  if (brief.website_url) lines.push(`Website: ${brief.website_url}`);
  if (brief.timeline_start || brief.timeline_end) {
    lines.push(`Timeline: ${brief.timeline_start ?? '?'} → ${brief.timeline_end ?? '?'}`);
  }
  if (brief.notes) lines.push(`Ghi chú: ${brief.notes}`);
  return lines.length ? lines : ['(Brief trống)'];
}

function recordLines(record: Record<string, string>, labels: Record<string, string>): string[] {
  const keys = Object.keys(labels);
  const lines: string[] = [];
  for (const key of keys) {
    const val = String(record[key] ?? '').trim();
    if (!val) continue;
    lines.push(`${labels[key] ?? key}: ${val}`);
  }
  for (const [key, val] of Object.entries(record)) {
    if (keys.includes(key)) continue;
    const t = String(val ?? '').trim();
    if (t) lines.push(`${key}: ${t}`);
  }
  return lines.length ? lines : ['(Chưa có nội dung)'];
}

function campaignLines(campaigns: MktAiCampaignDraft[]): string[] {
  if (!campaigns.length) return ['(Chưa có chiến dịch)'];
  const lines: string[] = [];
  campaigns.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.name || 'Chiến dịch'} — ${c.objective || '—'}`);
    lines.push(`   Kênh: ${(c.channel_mix ?? []).join(', ') || '—'}`);
    lines.push(`   Ngân sách: ${c.budget_pct ?? 0}%`);
    if (c.timeline_weeks) lines.push(`   Timeline: ${c.timeline_weeks}`);
    if (c.kpis?.length) lines.push(`   KPI: ${c.kpis.join('; ')}`);
    if (c.milestones?.length) lines.push(`   Mốc: ${c.milestones.join('; ')}`);
  });
  return lines;
}

function calendarLines(rows: ContentCalendarRow[]): string[] {
  if (!rows.length) return ['(Chưa có lịch nội dung)'];
  return rows.slice(0, 40).map((r) => {
    const parts = [r.date, r.type, r.channel, r.copy].filter(Boolean);
    return parts.join(' · ') || '—';
  });
}

export function buildExportDocument(input: {
  lifecycleId: number;
  stage: string;
  serviceSlug: string;
  brand: string;
  qualityScore: number;
  isDraftExport: boolean;
  brief: MktAiBrief | null;
  draft: MktAiDraft;
}): MktAiExportDocument {
  return {
    lifecycleId: input.lifecycleId,
    stage: input.stage,
    brand: input.brand,
    serviceSlug: input.serviceSlug,
    qualityScore: input.qualityScore,
    isDraftExport: input.isDraftExport,
    brief: input.brief,
    draft: input.draft,
    exportedAt: new Date().toISOString(),
  };
}

export function buildExportSections(doc: MktAiExportDocument): MktAiExportSection[] {
  const campaigns = normalizeCampaigns(doc.draft.campaigns_json);
  const calendar = normalizeCalendar(
    (doc.draft.content_json as Record<string, unknown> | undefined)?.calendar ??
      doc.draft.content_json,
  );

  const header: MktAiExportSection = {
    title: doc.isDraftExport ? 'KẾ HOẠCH MARKETING (DRAFT)' : 'KẾ HOẠCH MARKETING',
    lines: [
      ...(doc.isDraftExport
        ? ['⚠ DRAFT — Chưa apply vào TMMT chính thức. Chỉ dùng nội bộ review.']
        : []),
      `Thương hiệu: ${doc.brand}`,
      `Lifecycle: #${doc.lifecycleId}`,
      `Stage: ${doc.stage}`,
      `Dịch vụ: ${doc.serviceSlug}`,
      `Quality score: ${doc.qualityScore}/100`,
      `Xuất lúc: ${doc.exportedAt}`,
    ],
  };

  return [
    header,
    { title: 'Brief tóm tắt', lines: briefLines(doc.brief) },
    {
      title: 'Khung chiến lược',
      lines: recordLines(doc.draft.strategy_framework ?? {}, EXPORT_STRATEGY_LABELS),
    },
    {
      title: 'TMMT — Thị trường mục tiêu',
      lines: recordLines(doc.draft.target_market_prof ?? {}, EXPORT_TMMT_LABELS),
    },
    { title: 'Chiến dịch', lines: campaignLines(campaigns) },
    { title: 'Lịch nội dung (tóm tắt)', lines: calendarLines(calendar) },
  ];
}

export function buildExportFilename(brand: string, format: string, isDraftExport: boolean): string {
  const slug = String(brand || 'plan')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === 'xlsx' ? 'xlsx' : format;
  const draft = isDraftExport ? '-DRAFT' : '';
  return `${slug || 'plan'}${draft}-${date}.${ext}`;
}

export const DEFAULT_FUNNEL_KPIS = [
  { category: 'Awareness', metric: 'Impressions', target: '', unit: 'lượt', cadence: 'Weekly' },
  { category: 'Engagement', metric: 'CTR', target: '', unit: '%', cadence: 'Weekly' },
  { category: 'Lead', metric: 'CPL', target: '', unit: 'VND', cadence: 'Weekly' },
  { category: 'Lead', metric: 'Leads', target: '', unit: 'lead', cadence: 'Weekly' },
  { category: 'Pipeline', metric: 'MQL', target: '', unit: 'lead', cadence: 'Weekly' },
  { category: 'Pipeline', metric: 'SQL', target: '', unit: 'lead', cadence: 'Weekly' },
  { category: 'Efficiency', metric: 'CAC', target: '', unit: 'VND', cadence: 'Monthly' },
  { category: 'Efficiency', metric: 'ROAS', target: '', unit: 'x', cadence: 'Monthly' },
];

export function collectKpiRows(campaigns: MktAiCampaignDraft[]): Array<{
  campaign: string;
  kpi: string;
  objective: string;
  channel: string;
}> {
  const rows: Array<{ campaign: string; kpi: string; objective: string; channel: string }> = [];
  for (const c of campaigns) {
    const kpis = c.kpis?.length ? c.kpis : ['(Chưa định nghĩa KPI)'];
    for (const kpi of kpis) {
      rows.push({
        campaign: c.name || '—',
        kpi,
        objective: c.objective || '—',
        channel: (c.channel_mix ?? []).join(', ') || '—',
      });
    }
  }
  return rows;
}
