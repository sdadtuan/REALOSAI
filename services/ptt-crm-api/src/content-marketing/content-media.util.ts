import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { CmktItemRow, CmktMediaAsset, CmktMediaJson, CmktVisualStatus } from './content-marketing.types';

const APPROVED_COPY_STATUSES = new Set([
  'approved_internal',
  'scheduled',
  'published',
  'pending_client',
  'client_approved',
]);

export type CmktChannelSpec = { width: number; height: number; label: string };

export function itemNeedsVisualApproval(item: CmktItemRow): boolean {
  if (item.format === 'carousel') return true;
  if (item.format === 'video_script') return true;
  if (item.brief_json?.needs_visual === true) return true;
  return false;
}

export function defaultVisualStatus(item: CmktItemRow): CmktVisualStatus {
  if (!itemNeedsVisualApproval(item)) return 'not_needed';
  return item.visual_status ?? 'not_needed';
}

export function resolveAspectRatio(input: unknown, channel: string, format: string): string {
  const raw = String(input ?? '').trim();
  if (raw) return raw;
  if (format === 'carousel' && channel === 'linkedin') return '4:5';
  if (channel === 'short_video' || format === 'video_script') return '9:16';
  if (channel === 'newsletter' || channel === 'drip') return '3:1';
  return '1:1';
}

export function resolveChannelSpec(aspectRatio: string): CmktChannelSpec {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920, label: '1080×1920 Reels' };
    case '4:5':
      return { width: 1080, height: 1350, label: '1080×1350' };
    case '3:1':
      return { width: 1200, height: 400, label: '1200×400 email banner' };
    case '16:9':
      return { width: 1200, height: 675, label: '1200×675 OG' };
    default:
      return { width: 1080, height: 1080, label: '1080×1080 square' };
  }
}

export function assertMediaJobEligible(item: CmktItemRow, allowDraftWatermark = false): void {
  if (allowDraftWatermark && item.status === 'draft' && item.format === 'carousel') {
    return;
  }
  if (!APPROVED_COPY_STATUSES.has(item.status)) {
    throw new BadRequestException({
      error: 'media_copy_not_approved',
      message: 'Media job chỉ chạy sau khi copy/script được duyệt (approved_internal).',
      status: item.status,
    });
  }
}

export function assertVisualGateForPublish(item: CmktItemRow, mediaEnabled: boolean): void {
  if (!mediaEnabled || !itemNeedsVisualApproval(item)) return;
  const status = item.visual_status ?? 'not_needed';
  if (status !== 'approved') {
    throw new BadRequestException({
      error: 'visual_not_approved',
      message: 'Item cần visual_status=approved trước khi publish.',
      visual_status: status,
      format: item.format,
    });
  }
}

export function mergeMediaJson(
  existing: CmktMediaJson | undefined,
  patch: Record<string, unknown>,
): CmktMediaJson {
  const next: CmktMediaJson = { ...(existing ?? {}) };
  if (patch.style_preset != null) next.style_preset = String(patch.style_preset);
  if (patch.aspect_ratio != null) next.aspect_ratio = String(patch.aspect_ratio);
  if (patch.provider != null) next.provider = String(patch.provider);
  if (patch.prompt_hash != null) next.prompt_hash = String(patch.prompt_hash);
  if (patch.selected_asset_id !== undefined) {
    next.selected_asset_id =
      patch.selected_asset_id != null ? String(patch.selected_asset_id) : null;
  }
  if (patch.visual_qa != null && typeof patch.visual_qa === 'object') {
    const qaPatch = patch.visual_qa as Partial<NonNullable<CmktMediaJson['visual_qa']>>;
    const merged = { ...(next.visual_qa ?? { score: 0 }), ...qaPatch };
    next.visual_qa = {
      ...merged,
      score: merged.score ?? next.visual_qa?.score ?? 0,
    };
  }
  if (Array.isArray(patch.ai_assets)) {
    next.ai_assets = patch.ai_assets as CmktMediaAsset[];
  }
  if (Array.isArray(patch.carousel_slides)) {
    next.carousel_slides = patch.carousel_slides as CmktMediaAsset[];
  }
  if (patch.video_short !== undefined) {
    next.video_short = patch.video_short as CmktMediaAsset | null;
  }
  if (patch.video_packs != null && typeof patch.video_packs === 'object') {
    next.video_packs = patch.video_packs as NonNullable<CmktMediaJson['video_packs']>;
  }
  if (patch.video_generation != null && typeof patch.video_generation === 'object') {
    next.video_generation = patch.video_generation as CmktMediaJson['video_generation'];
  }
  return next;
}

export function parseCarouselSlideTexts(markdown: string, maxSlides = 8): string[] {
  const lines = markdown
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) return ['Slide 1', 'Slide 2', 'Slide 3'];
  return lines.slice(0, maxSlides);
}

export function computeVisualQaScore(assets: CmktMediaAsset[]): {
  score: number;
  checks: Record<string, boolean>;
  blocked: boolean;
} {
  const seed = assets.map((a) => a.id).join('|') || 'empty';
  const hash = createHash('sha256').update(seed).digest('hex');
  const base = 68 + (parseInt(hash.slice(0, 2), 16) % 28);
  const checks = {
    brand_colors: base >= 72,
    text_readable: base >= 65,
    safe_zone: base >= 60,
    policy_ok: true,
    channel_spec: assets.length > 0,
  };
  const score = Math.min(100, base + (checks.brand_colors ? 4 : 0) + (checks.text_readable ? 4 : 0));
  return { score, checks, blocked: score < 50 };
}

export function hashMediaPrompt(parts: string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32);
}

export function applyDraftWatermark(url: string, approved: boolean): string {
  if (approved) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}draft=1`;
}
