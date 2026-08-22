import { BadRequestException } from '@nestjs/common';
import type { CmktItemRow, CmktProductionJson, CmktProductionPhase } from './content-marketing.types';

export function itemNeedsProduction(item: CmktItemRow): boolean {
  if (item.format === 'carousel') return true;
  if (item.format === 'video_script') return true;
  if (item.brief_json?.needs_visual === true) return true;
  return false;
}

export function defaultProductionPhase(item: CmktItemRow): CmktProductionPhase {
  if (!itemNeedsProduction(item)) return 'none';
  if (item.format === 'video_script') return 'awaiting_video';
  if (item.format === 'carousel' || item.brief_json?.needs_visual === true) return 'awaiting_design';
  return 'none';
}

export function mergeProductionJson(
  existing: CmktProductionJson | undefined,
  patch: Record<string, unknown>,
): CmktProductionJson {
  const next: CmktProductionJson = { ...(existing ?? {}) };
  if (patch.phase != null) next.phase = String(patch.phase) as CmktProductionPhase;
  if (patch.assignee_designer_id !== undefined) {
    next.assignee_designer_id =
      patch.assignee_designer_id != null ? Number(patch.assignee_designer_id) : null;
  }
  if (patch.assignee_video_id !== undefined) {
    next.assignee_video_id = patch.assignee_video_id != null ? Number(patch.assignee_video_id) : null;
  }
  if (patch.brief_exported_at !== undefined) {
    next.brief_exported_at = patch.brief_exported_at != null ? String(patch.brief_exported_at) : null;
  }
  if (patch.final_video_url !== undefined) {
    next.final_video_url = patch.final_video_url != null ? String(patch.final_video_url).trim() : null;
  }
  if (patch.subtitle_text !== undefined) {
    next.subtitle_text = patch.subtitle_text != null ? String(patch.subtitle_text) : null;
  }
  if (patch.creative_id !== undefined) {
    next.creative_id = patch.creative_id != null ? String(patch.creative_id).trim() : null;
  }
  if (patch.notes !== undefined) {
    next.notes = patch.notes != null ? String(patch.notes) : null;
  }
  if (patch.escalate_human !== undefined) {
    next.escalate_human = Boolean(patch.escalate_human);
  }
  if (Array.isArray(patch.asset_urls)) {
    next.asset_urls = patch.asset_urls.map((u) => String(u).trim()).filter(Boolean);
  } else if (patch.asset_urls !== undefined && patch.asset_urls != null) {
    next.asset_urls = [String(patch.asset_urls).trim()].filter(Boolean);
  }
  if (Array.isArray(patch.chapter_markers)) {
    next.chapter_markers = patch.chapter_markers.map((m) => String(m)).filter(Boolean);
  }
  return next;
}

export function assertProductionGateForPublish(item: CmktItemRow): void {
  if (!itemNeedsProduction(item)) return;
  if (item.format === 'carousel' && item.visual_status === 'approved') return;
  const phase = item.production_json?.phase ?? defaultProductionPhase(item);
  if (phase !== 'done') {
    throw new BadRequestException({
      error: 'production_not_done',
      message: 'Item cần hoàn tất production (phase=done) trước khi publish.',
      phase,
      format: item.format,
    });
  }
}

export function buildDesignBriefMarkdown(item: CmktItemRow): string {
  const md = String(item.body_json?.markdown ?? '').trim();
  return [
    `# Creative brief — ${item.title}`,
    '',
    `Channel: ${item.channel} / ${item.format}`,
    `Goal: ${item.funnel_goal || '—'}`,
    '',
    '## Copy đã duyệt',
    '',
    md || '(empty)',
    '',
    '## Ghi chú',
    '',
    String(item.production_json?.notes ?? item.brief_json?.notes ?? '—'),
  ].join('\n');
}

export function buildScriptExportMarkdown(item: CmktItemRow): string {
  const md = String(item.body_json?.markdown ?? '').trim();
  return [`# Video script — ${item.title}`, '', md || '(empty)'].join('\n');
}
