import type { MethodologyBlock } from './market-research.types';

export const ISO_GAP_BANNER =
  'Gap-check nội bộ — không thay audit ISO 20252 và không chứng nhận đạt chuẩn.';

export type IsoGapStatus = 'pass' | 'partial' | 'fail' | 'na';

export type IsoGapPhase = 'planning' | 'execution' | 'supervision' | 'reporting';

export type IsoGapItem = {
  id: string;
  phase: IsoGapPhase;
  label_vi: string;
  status: IsoGapStatus;
  hint_vi?: string;
};

export type IsoGapSummary = {
  pass: number;
  partial: number;
  fail: number;
  na: number;
};

export type IsoGapInput = {
  project: {
    decision_statement?: string | null;
    product_type: string;
    dv12_tier?: string;
    geo?: unknown;
  };
  rq_count: number;
  source_count: number;
  verified_evidence_count: number;
  study_count: number;
  ai_run_count: number;
  insight_counts: { draft: number; published: number; approved_client_facing: number };
  acf_with_verified_evidence: number;
  review_count: number;
  latest_report?: { methodology?: Record<string, unknown>; findings_count: number } | null;
};

function parseGeoList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? '').trim()).filter(Boolean);
      }
    } catch {
      return raw.trim() ? [raw.trim()] : [];
    }
  }
  return [];
}

function methodologyGapStatus(
  tier: string | undefined,
  methodology?: Record<string, unknown> | null,
): IsoGapStatus {
  if (!methodology || typeof methodology !== 'object') return 'fail';
  const m = methodology as MethodologyBlock;
  if (tier === 'CB' && m.stub === true) return 'pass';
  const fields = [m.population, m.source_plan, m.limitation];
  const filled = fields.filter((f) => String(f ?? '').trim().length >= 8);
  if (filled.length === 3) return 'pass';
  if (filled.length > 0 || m.stub === true) return 'partial';
  return 'fail';
}

export function summarizeIsoGapItems(items: IsoGapItem[]): IsoGapSummary {
  const summary: IsoGapSummary = { pass: 0, partial: 0, fail: 0, na: 0 };
  for (const item of items) summary[item.status] += 1;
  return summary;
}

export function buildIso20252GapCheck(input: IsoGapInput): IsoGapItem[] {
  const ds = String(input.project.decision_statement ?? '').trim();
  const geo = parseGeoList(input.project.geo);
  const productType = String(input.project.product_type ?? '').trim();
  const tier = String(input.project.dv12_tier ?? 'CB');
  const report = input.latest_report ?? null;

  const items: IsoGapItem[] = [
    {
      id: 'decision_statement',
      phase: 'planning',
      label_vi: 'Decision statement',
      status: ds.length >= 20 ? 'pass' : ds.length >= 8 ? 'partial' : 'fail',
      hint_vi: ds.length >= 20 ? undefined : 'Cần ≥20 ký tự mô tả quyết định kinh doanh.',
    },
    {
      id: 'has_rq',
      phase: 'planning',
      label_vi: 'Research question',
      status: input.rq_count >= 1 ? 'pass' : 'fail',
      hint_vi: input.rq_count >= 1 ? undefined : 'Thêm ≥1 câu hỏi nghiên cứu.',
    },
    {
      id: 'product_type',
      phase: 'planning',
      label_vi: 'Loại sản phẩm nghiên cứu',
      status: productType ? 'pass' : 'fail',
      hint_vi: productType ? undefined : 'Chọn product type hợp lệ.',
    },
    {
      id: 'geo',
      phase: 'planning',
      label_vi: 'Phạm vi địa lý',
      status: geo.length >= 1 ? 'pass' : 'fail',
      hint_vi: geo.length >= 1 ? undefined : 'Khai báo ít nhất một thị trường/geo.',
    },
    {
      id: 'has_source',
      phase: 'execution',
      label_vi: 'Nguồn thu thập',
      status: input.source_count >= 1 ? 'pass' : 'fail',
      hint_vi: input.source_count >= 1 ? undefined : 'Thêm ≥1 nguồn (desk/field/vendor).',
    },
    {
      id: 'has_verified_evidence',
      phase: 'execution',
      label_vi: 'Evidence đã verify',
      status: input.verified_evidence_count >= 1 ? 'pass' : 'fail',
      hint_vi:
        input.verified_evidence_count >= 1 ? undefined : 'Cần ≥1 evidence qc_status=verified.',
    },
    {
      id: 'has_study_or_desk',
      phase: 'execution',
      label_vi: 'Study hoặc desk run',
      status:
        input.study_count >= 1 || input.ai_run_count >= 1 || input.source_count >= 1
          ? 'pass'
          : 'fail',
      hint_vi:
        input.study_count >= 1 || input.ai_run_count >= 1 || input.source_count >= 1
          ? undefined
          : 'Chạy desk/deep hoặc tạo study/survey.',
    },
    {
      id: 'has_insight_review',
      phase: 'supervision',
      label_vi: 'Review insight',
      status: input.review_count >= 1 ? 'pass' : 'fail',
      hint_vi: input.review_count >= 1 ? undefined : 'Ghi nhận ≥1 review trên insight/report.',
    },
    {
      id: 'no_draft_published',
      phase: 'supervision',
      label_vi: 'Không publish insight nháp',
      status:
        input.insight_counts.published === 0
          ? 'pass'
          : input.review_count >= 1
            ? 'pass'
            : 'partial',
      hint_vi:
        input.insight_counts.published === 0 || input.review_count >= 1
          ? undefined
          : 'Insight published cần có review trước khi phát hành.',
    },
    {
      id: 'acf_has_evidence',
      phase: 'supervision',
      label_vi: 'Insight ACF có evidence verified',
      status:
        input.insight_counts.approved_client_facing === 0
          ? 'partial'
          : input.acf_with_verified_evidence >= 1
            ? 'pass'
            : 'fail',
      hint_vi:
        input.insight_counts.approved_client_facing === 0
          ? 'Chưa có insight approved_client_facing.'
          : input.acf_with_verified_evidence >= 1
            ? undefined
            : 'Mỗi insight ACF cần ≥1 evidence verified.',
    },
    {
      id: 'has_report_version',
      phase: 'reporting',
      label_vi: 'Phiên bản báo cáo',
      status: report ? 'pass' : 'fail',
      hint_vi: report ? undefined : 'Tạo ≥1 report version.',
    },
    {
      id: 'methodology_not_stub',
      phase: 'reporting',
      label_vi: 'Methodology đủ cho tier',
      status: report
        ? methodologyGapStatus(tier, report.methodology)
        : 'na',
      hint_vi:
        report && methodologyGapStatus(tier, report.methodology) !== 'pass'
          ? tier === 'CB'
            ? 'CB cho phép stub; TC/CS cần population, source_plan, limitation ≥8 ký tự.'
            : 'Điền đủ methodology trước export TC/CS.'
          : undefined,
    },
    {
      id: 'report_has_findings',
      phase: 'reporting',
      label_vi: 'Findings trong báo cáo',
      status: !report ? 'na' : report.findings_count >= 1 ? 'pass' : 'partial',
      hint_vi:
        report && report.findings_count < 1 ? 'Report version chưa có findings.' : undefined,
    },
  ];

  return items;
}
