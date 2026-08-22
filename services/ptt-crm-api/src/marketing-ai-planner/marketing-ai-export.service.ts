import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { MktAiPlannerContext } from './marketing-ai-planner.types';
import { EXPORT_STRATEGY_LABELS, EXPORT_TMMT_LABELS } from './marketing-ai-export-labels';
import type { MktAiExportFileResult, MktAiExportFormat } from './marketing-ai-export.types';
import { normalizeCalendar, normalizeCampaigns } from './marketing-ai-export.types';
import { buildMarketingPlanDocx } from './marketing-ai-docx.util';
import {
  buildExportDocument,
  buildExportFilename,
  buildExportSections,
  collectKpiRows,
  DEFAULT_FUNNEL_KPIS,
} from './marketing-ai-export.util';
import { buildMarketingPlanPdf } from './marketing-ai-pdf.util';

@Injectable()
export class MarketingAiExportService {
  async buildExport(input: {
    lifecycleId: number;
    ctx: MktAiPlannerContext;
    format: MktAiExportFormat;
    isDraftExport: boolean;
  }): Promise<MktAiExportFileResult> {
    const brand = input.ctx.brief?.brand_name ?? 'plan';
    const score = input.ctx.quality_score?.score ?? 0;
    const doc = buildExportDocument({
      lifecycleId: input.lifecycleId,
      stage: input.ctx.stage,
      serviceSlug: input.ctx.service_slug,
      brand,
      qualityScore: score,
      isDraftExport: input.isDraftExport,
      brief: input.ctx.brief,
      draft: input.ctx.draft,
    });
    const sections = buildExportSections(doc);
    const filename = buildExportFilename(brand, input.format, input.isDraftExport);

    if (input.format === 'pdf') {
      const buffer = buildMarketingPlanPdf(sections);
      return {
        format: 'pdf',
        filename,
        content: buffer.toString('base64'),
        mime_type: 'application/pdf',
        encoding: 'base64',
      };
    }

    if (input.format === 'docx') {
      const buffer = await buildMarketingPlanDocx(sections);
      return {
        format: 'docx',
        filename,
        content: buffer.toString('base64'),
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        encoding: 'base64',
      };
    }

    const buffer = await this.buildXlsx(doc);
    return {
      format: 'xlsx',
      filename,
      content: buffer.toString('base64'),
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      encoding: 'base64',
    };
  }

  private async buildXlsx(doc: ReturnType<typeof buildExportDocument>): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const campaigns = normalizeCampaigns(doc.draft.campaigns_json);
    const calendar = normalizeCalendar(
      (doc.draft.content_json as Record<string, unknown> | undefined)?.calendar ??
        doc.draft.content_json,
    );

    const wsOverview = wb.addWorksheet('Tong_quan');
    wsOverview.getCell('A1').value = doc.isDraftExport
      ? `KẾ HOẠCH MARKETING (DRAFT) — ${doc.brand}`
      : `KẾ HOẠCH MARKETING — ${doc.brand}`;
    wsOverview.getCell('A1').font = { bold: true, size: 14 };
    const overviewRows: Array<[string, string]> = [
      ['Lifecycle', `#${doc.lifecycleId}`],
      ['Stage', doc.stage],
      ['Dịch vụ', doc.serviceSlug],
      ['Quality score', `${doc.qualityScore}/100`],
      ['Xuất lúc', doc.exportedAt],
      ['Trạng thái TMMT', doc.isDraftExport ? 'DRAFT (chưa apply)' : 'Đã apply / chính thức'],
      ['Ngân sách tháng', doc.brief?.budget_monthly_vnd ? String(doc.brief.budget_monthly_vnd) : '—'],
      ['Mục tiêu', doc.brief?.objective ?? '—'],
      ['Geo', (doc.brief?.geo_markets ?? []).join(', ') || '—'],
    ];
    overviewRows.forEach(([k, v], i) => {
      const row = i + 3;
      wsOverview.getCell(`A${row}`).value = k;
      wsOverview.getCell(`A${row}`).font = { bold: true };
      wsOverview.getCell(`B${row}`).value = v;
    });
    wsOverview.getColumn(1).width = 22;
    wsOverview.getColumn(2).width = 48;

    const wsStrategy = wb.addWorksheet('Chien_luoc');
    wsStrategy.columns = [
      { header: 'Hạng mục', key: 'key', width: 32 },
      { header: 'Nội dung', key: 'value', width: 64 },
    ];
    wsStrategy.getRow(1).font = { bold: true };
    for (const [key, label] of Object.entries(EXPORT_STRATEGY_LABELS)) {
      wsStrategy.addRow({ key: label, value: doc.draft.strategy_framework?.[key] ?? '' });
    }

    const wsTmmt = wb.addWorksheet('TMMT');
    wsTmmt.columns = [
      { header: 'Trường TMMT', key: 'key', width: 32 },
      { header: 'Nội dung', key: 'value', width: 64 },
    ];
    wsTmmt.getRow(1).font = { bold: true };
    for (const [key, label] of Object.entries(EXPORT_TMMT_LABELS)) {
      wsTmmt.addRow({ key: label, value: doc.draft.target_market_prof?.[key] ?? '' });
    }

    const wsCampaigns = wb.addWorksheet('Campaigns');
    wsCampaigns.columns = [
      { header: 'Tên', key: 'name', width: 24 },
      { header: 'Mục tiêu', key: 'objective', width: 16 },
      { header: 'Kênh', key: 'channels', width: 28 },
      { header: 'Ngân sách %', key: 'budget_pct', width: 12 },
      { header: 'Timeline', key: 'timeline', width: 14 },
      { header: 'KPI', key: 'kpis', width: 32 },
    ];
    wsCampaigns.getRow(1).font = { bold: true };
    for (const c of campaigns) {
      wsCampaigns.addRow({
        name: c.name,
        objective: c.objective,
        channels: (c.channel_mix ?? []).join(', '),
        budget_pct: c.budget_pct,
        timeline: c.timeline_weeks ?? '',
        kpis: (c.kpis ?? []).join('; '),
      });
    }

    const wsKpi = wb.addWorksheet('KPI_Dashboard');
    wsKpi.columns = [
      { header: 'Chiến dịch', key: 'campaign', width: 22 },
      { header: 'KPI', key: 'kpi', width: 20 },
      { header: 'Mục tiêu CD', key: 'objective', width: 16 },
      { header: 'Kênh', key: 'channel', width: 24 },
    ];
    wsKpi.getRow(1).font = { bold: true };
    const kpiRows = collectKpiRows(campaigns);
    if (kpiRows.length) {
      for (const row of kpiRows) wsKpi.addRow(row);
    } else {
      for (const row of DEFAULT_FUNNEL_KPIS) {
        wsKpi.addRow({
          campaign: '(Funnel mặc định)',
          kpi: row.metric,
          objective: row.category,
          channel: row.cadence,
        });
      }
    }

    const wsFunnel = wb.addWorksheet('KPI_Funnel');
    wsFunnel.columns = [
      { header: 'Nhóm', key: 'category', width: 16 },
      { header: 'Chỉ số', key: 'metric', width: 16 },
      { header: 'Target', key: 'target', width: 12 },
      { header: 'Đơn vị', key: 'unit', width: 10 },
      { header: 'Cadence', key: 'cadence', width: 12 },
    ];
    wsFunnel.getRow(1).font = { bold: true };
    for (const row of DEFAULT_FUNNEL_KPIS) wsFunnel.addRow(row);

    const wsCal = wb.addWorksheet('Lich_noi_dung');
    wsCal.columns = [
      { header: 'Ngày', key: 'date', width: 12 },
      { header: 'Loại', key: 'type', width: 14 },
      { header: 'Kênh', key: 'channel', width: 16 },
      { header: 'Nội dung / Copy', key: 'copy', width: 48 },
    ];
    wsCal.getRow(1).font = { bold: true };
    for (const row of calendar) wsCal.addRow(row);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
