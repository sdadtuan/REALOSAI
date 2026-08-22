import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildMarketingPlanPdf } from '../marketing-ai-planner/marketing-ai-pdf.util';
import type { MktAiExportSection } from '../marketing-ai-planner/marketing-ai-export.types';
import {
  PRELIMINARY_STRATEGY_KEYS,
  STRATEGY_FRAMEWORK_KEYS,
} from '../leads-funnel/presales-marketing-plan.util';
import {
  QUOTE_PACKAGE_TIERS,
  QUOTE_TIER_VI,
  type QuotePackageTier,
} from '../proposals/quote-pricing.util';

export const STRATEGY_LABELS_VI: Record<string, string> = {
  target_market: 'Thị trường mục tiêu',
  market_message: 'Thông điệp thị trường',
  media_reach: 'Kênh tiếp cận / Media',
  conversion_strategy: 'Chiến lược chuyển đổi',
  retention_system: 'Hệ thống giữ chân',
  nurture_system: 'Nuôi dưỡng lead',
  world_class_experience: 'Trải nghiệm đẳng cấp',
  lifecycle_extension: 'Gia hạn lifecycle',
  referral_engine: 'Giới thiệu / Referral',
};

export type DealRoomPackTimelineMilestone = {
  phase: string;
  weeks: string;
  summary: string;
};

export type DealRoomPackQuoteLine = {
  dv_code: string;
  dv_name: string;
  package_tier: string;
  final_price_vnd: number;
  scope_notes?: string;
};

export type DealRoomPackTierQuote = {
  tier: QuotePackageTier;
  tier_label: string;
  lines: DealRoomPackQuoteLine[];
  total_vnd: number;
  is_reference?: boolean;
};

export type DealRoomPackInput = {
  lead_id: number;
  lead_name: string;
  service_slug: string;
  export_date: string;
  owner_name: string | null;
  solution_name: string | null;
  marketing_plan: {
    name: string;
    north_star: string;
    objectives: string;
    strategy_framework: Record<string, string>;
  };
  quote_tiers: DealRoomPackTierQuote[];
  proposal_id: number | null;
  include_timeline: boolean;
  show_ai_disclaimer: boolean;
};

type TimelineConfig = Record<string, DealRoomPackTimelineMilestone[]>;

let timelineCache: TimelineConfig | null = null;

function loadTimelineConfig(): TimelineConfig {
  if (timelineCache) return timelineCache;
  const candidates = [
    path.join(__dirname, 'deal-room-pack-timeline.json'),
    path.join(process.cwd(), 'src/deal-room/deal-room-pack-timeline.json'),
    path.join(process.cwd(), 'services/ptt-crm-api/src/deal-room/deal-room-pack-timeline.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      timelineCache = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TimelineConfig;
      return timelineCache;
    }
  }
  timelineCache = {};
  return timelineCache;
}

export function resolvePackTimeline(serviceSlug: string): DealRoomPackTimelineMilestone[] {
  const cfg = loadTimelineConfig();
  const slug = String(serviceSlug ?? '').trim();
  return cfg[slug] ?? cfg.default ?? [];
}

export function formatVnd(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${Math.round(n).toLocaleString('vi-VN')} VND`;
}

export function dealPackExportFilename(leadId: number, exportDate: string): string {
  const d = exportDate.slice(0, 10).replace(/-/g, '');
  return `PTT-DealPack-${leadId}-${d || 'export'}.pdf`;
}

function truncate(text: string, maxLen: number): string {
  const t = String(text ?? '').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function buildCoverSection(input: DealRoomPackInput): MktAiExportSection {
  const dateLabel = input.export_date.slice(0, 10);
  const lines = [
    'PTT Ads — Plan + Quote Pack',
    '',
    `Khách hàng: ${input.lead_name}`,
    `Dịch vụ: ${input.service_slug || '—'}`,
    `Ngày: ${dateLabel}`,
  ];
  if (input.owner_name) lines.push(`AM: ${input.owner_name}`);
  if (input.solution_name) lines.push(`Solution: ${input.solution_name}`);
  if (input.proposal_id) lines.push(`Báo giá tham chiếu: #${input.proposal_id}`);
  lines.push('', 'Tài liệu hỗ trợ chốt deal — không thay TMMT L2 sau ký hợp đồng.');
  return { title: 'Bìa', lines };
}

function buildL1Section(input: DealRoomPackInput): MktAiExportSection {
  const plan = input.marketing_plan;
  const lines: string[] = [];
  if (plan.name) lines.push(`Tên kế hoạch: ${plan.name}`);
  lines.push('');
  if (plan.north_star) {
    lines.push('North Star');
    lines.push(truncate(plan.north_star, 600));
    lines.push('');
  }
  if (plan.objectives) {
    lines.push('Mục tiêu chiến lược');
    lines.push(truncate(plan.objectives, 600));
    lines.push('');
  }
  const keys = [...PRELIMINARY_STRATEGY_KEYS, ...STRATEGY_FRAMEWORK_KEYS].filter(
    (k, i, arr) => arr.indexOf(k) === i,
  );
  for (const key of keys) {
    const value = String(plan.strategy_framework[key] ?? '').trim();
    if (!value) continue;
    const label = STRATEGY_LABELS_VI[key] ?? key;
    lines.push(label);
    lines.push(truncate(value, 400));
    lines.push('');
  }
  if (lines.length <= 2) {
    lines.push('(Chưa có nội dung L1 chi tiết — hoàn thiện R5 trên Deal Room.)');
  }
  return { title: 'L1 — KH Marketing sơ bộ', lines };
}

function buildQuoteSection(input: DealRoomPackInput): MktAiExportSection {
  const lines: string[] = [
    'Báo giá 3 gói — Basic / Standard / Premium',
    'Giá tham chiếu từ catalog DV; báo giá chính thức theo proposal đã duyệt nội bộ.',
    '',
  ];
  const tiers =
    input.quote_tiers.length > 0
      ? input.quote_tiers
      : QUOTE_PACKAGE_TIERS.map((tier) => ({
          tier,
          tier_label: QUOTE_TIER_VI[tier],
          lines: [],
          total_vnd: 0,
          is_reference: true,
        }));

  for (const tierBlock of tiers) {
    lines.push(`— ${tierBlock.tier_label} (${tierBlock.tier}) —`);
    if (tierBlock.lines.length) {
      for (const line of tierBlock.lines) {
        const note = line.scope_notes ? ` · ${truncate(line.scope_notes, 80)}` : '';
        lines.push(
          `${line.dv_code} ${line.dv_name}: ${formatVnd(line.final_price_vnd)}${note}`,
        );
      }
    } else {
      lines.push('(Chưa có dòng DV — tạo báo giá từ Deal Room hoặc /crm/proposals)');
    }
    lines.push(`Tổng gói: ${formatVnd(tierBlock.total_vnd)}`);
    if (tierBlock.is_reference) lines.push('(Giá tham chiếu catalog)');
    lines.push('');
  }
  return { title: 'Báo giá 3 gói', lines };
}

function buildTimelineSection(input: DealRoomPackInput): MktAiExportSection | null {
  if (!input.include_timeline) return null;
  const milestones = resolvePackTimeline(input.service_slug);
  if (!milestones.length) return null;
  const lines: string[] = [
    'Timeline 90 ngày (high-level) — không phải TMMT đầy đủ',
    '',
  ];
  for (const m of milestones) {
    lines.push(`${m.phase} · ${m.weeks}`);
    lines.push(m.summary);
    lines.push('');
  }
  return { title: 'Timeline 90 ngày', lines };
}

function buildFooterSection(input: DealRoomPackInput): MktAiExportSection {
  const lines = [
    'PTT Ads · RNOSAI Deal Room',
    'Tài liệu này phục vụ buổi chốt deal — không phải hợp đồng hay TMMT L2.',
  ];
  if (input.show_ai_disclaimer) {
    lines.push('');
    lines.push('Bản nháp hỗ trợ AI — đã hiệu chỉnh bởi chuyên gia PTT.');
  }
  return { title: 'Pháp lý & ghi chú', lines };
}

export function buildDealRoomPackSections(input: DealRoomPackInput): MktAiExportSection[] {
  const sections: MktAiExportSection[] = [
    buildCoverSection(input),
    buildL1Section(input),
    buildQuoteSection(input),
  ];
  const timeline = buildTimelineSection(input);
  if (timeline) sections.push(timeline);
  sections.push(buildFooterSection(input));
  return sections;
}

export function buildDealRoomPackPdf(input: DealRoomPackInput): Buffer {
  return buildMarketingPlanPdf(buildDealRoomPackSections(input));
}
