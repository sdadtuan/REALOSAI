import type { MktAiBrief, MktAiCampaignDraft, MktAiDraft } from './marketing-ai-planner.types';

export type MktAiExportFormat = 'pdf' | 'docx' | 'xlsx' | 'pptx';

export interface MktAiExportDocument {
  lifecycleId: number;
  stage: string;
  brand: string;
  serviceSlug: string;
  qualityScore: number;
  isDraftExport: boolean;
  brief: MktAiBrief | null;
  draft: MktAiDraft;
  exportedAt: string;
}

export interface MktAiExportFileResult {
  format: MktAiExportFormat;
  filename: string;
  content: string;
  mime_type: string;
  encoding: 'base64' | 'utf8';
}

export interface MktAiExportSection {
  title: string;
  lines: string[];
}

export type ContentCalendarRow = {
  date?: string;
  type?: string;
  channel?: string;
  copy?: string;
};

export function normalizeCampaigns(raw: unknown): MktAiCampaignDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw as MktAiCampaignDraft[];
}

export function normalizeCalendar(raw: unknown): ContentCalendarRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      date: String(r.date ?? ''),
      type: String(r.type ?? ''),
      channel: String(r.channel ?? ''),
      copy: String(r.copy ?? ''),
    };
  });
}
