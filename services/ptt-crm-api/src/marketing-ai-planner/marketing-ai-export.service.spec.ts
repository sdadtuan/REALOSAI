import { MarketingAiExportService } from './marketing-ai-export.service';
import { buildExportSections, buildExportDocument } from './marketing-ai-export.util';
import { buildMarketingPlanPdf } from './marketing-ai-pdf.util';
import type { MktAiPlannerContext } from './marketing-ai-planner.types';

function sampleCtx(overrides?: Partial<MktAiPlannerContext>): MktAiPlannerContext {
  return {
    lifecycle_id: 1,
    stage: 'onboard',
    service_slug: 'meta-lead-gen',
    enabled: true,
    brief: {
      brand_name: 'Acme Corp',
      industry: 'B2B SaaS',
      service_slug: 'meta-lead-gen',
      objective: 'lead',
      budget_monthly_vnd: 25000000,
      geo_markets: ['HCM', 'HN'],
      challenges: 'CPL cao, thiếu ICP rõ',
    },
    brief_validation: { ok: true, missing: [], messages: [] },
    prefill_sources: [],
    jobs: [],
    draft: {
      strategy_framework: {
        target_market: 'SMB B2B tại VN',
        market_message: 'Giảm CPL 30% trong 90 ngày',
      },
      target_market_prof: {
        market_context: 'Thị trường ads cạnh tranh',
        segmentation_icp: 'Công ty 20-200 nhân sự, ngân sách MKT 20-100tr/tháng, cần lead chất lượng',
        personas_roles: 'CMO / Head of Growth',
      },
      swot_json: {},
      campaigns_json: [
        {
          name: 'Meta Lead Gen Q3',
          objective: 'lead',
          channel_mix: ['Meta', 'Google'],
          budget_pct: 60,
          kpis: ['CPL < 150k', 'MQL 40/tháng'],
        },
      ],
      content_json: {
        calendar: [
          { date: '2026-08-01', type: 'Post', channel: 'Meta', copy: 'Hook ICP pain' },
        ],
      },
      quality_score_json: {},
    },
    tmmt_validation: { ok: false, messages: ['DRAFT'] },
    quality_score: {
      score: 75,
      criteria: {},
      can_apply: true,
      can_export: true,
      can_export_docx_only: false,
    },
    flags: { rag_enabled: false, approval_required: false, stub_mode: true },
    ...overrides,
  };
}

describe('MarketingAiExportService', () => {
  const service = new MarketingAiExportService();

  it('builds valid PDF with base64 encoding', async () => {
    const out = await service.buildExport({
      lifecycleId: 1,
      ctx: sampleCtx(),
      format: 'pdf',
      isDraftExport: true,
    });
    expect(out.encoding).toBe('base64');
    expect(out.mime_type).toBe('application/pdf');
    expect(out.filename).toContain('-DRAFT');
    expect(out.filename.endsWith('.pdf')).toBe(true);
    const raw = Buffer.from(out.content, 'base64');
    expect(raw.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });

  it('builds DOCX zip (PK header)', async () => {
    const out = await service.buildExport({
      lifecycleId: 1,
      ctx: sampleCtx({ tmmt_validation: { ok: true, messages: [] } }),
      format: 'docx',
      isDraftExport: false,
    });
    const raw = Buffer.from(out.content, 'base64');
    expect(raw.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(out.filename.endsWith('.docx')).toBe(true);
    expect(out.filename).not.toContain('-DRAFT');
  });

  it('builds XLSX with correct mime and extension', async () => {
    const out = await service.buildExport({
      lifecycleId: 1,
      ctx: sampleCtx(),
      format: 'xlsx',
      isDraftExport: true,
    });
    expect(out.mime_type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(out.filename.endsWith('.xlsx')).toBe(true);
    const raw = Buffer.from(out.content, 'base64');
    expect(raw.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('includes DRAFT watermark in sections when draft export', () => {
    const doc = buildExportDocument({
      lifecycleId: 1,
      stage: 'onboard',
      serviceSlug: 'meta-lead-gen',
      brand: 'Acme',
      qualityScore: 65,
      isDraftExport: true,
      brief: sampleCtx().brief,
      draft: sampleCtx().draft,
    });
    const sections = buildExportSections(doc);
    expect(sections[0].title).toContain('DRAFT');
    expect(sections[0].lines.some((l) => l.includes('DRAFT'))).toBe(true);
  });

  it('pdf util produces %%EOF trailer', () => {
    const doc = buildExportDocument({
      lifecycleId: 1,
      stage: 'onboard',
      serviceSlug: 'meta-lead-gen',
      brand: 'Acme',
      qualityScore: 80,
      isDraftExport: false,
      brief: sampleCtx().brief,
      draft: sampleCtx().draft,
    });
    const pdf = buildMarketingPlanPdf(buildExportSections(doc));
    expect(pdf.toString('utf8').includes('%%EOF')).toBe(true);
  });
});
