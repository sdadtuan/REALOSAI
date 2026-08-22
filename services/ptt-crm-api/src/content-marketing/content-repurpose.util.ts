import { BadRequestException } from '@nestjs/common';
import type { CmktItemRow, CmktRepurposeTarget } from './content-marketing.types';
import type { CmktPromptProfile } from './content-marketing-prompt.util';

export type CmktRepurposeTransform = {
  transform_type: string;
  prompt_profile: CmktPromptProfile;
  source: { channel: string; format: string };
  target: { channel: string; format: string };
  label: string;
};

export const CMKT_REPURPOSE_TRANSFORMS: CmktRepurposeTransform[] = [
  {
    transform_type: 'blog_to_social_fb',
    prompt_profile: 'social_fb',
    source: { channel: 'website', format: 'blog' },
    target: { channel: 'facebook', format: 'social_post' },
    label: 'Blog → Facebook post',
  },
  {
    transform_type: 'blog_to_social_li',
    prompt_profile: 'social_li',
    source: { channel: 'website', format: 'blog' },
    target: { channel: 'linkedin', format: 'social_post' },
    label: 'Blog → LinkedIn post',
  },
  {
    transform_type: 'blog_to_email',
    prompt_profile: 'email_broadcast',
    source: { channel: 'website', format: 'blog' },
    target: { channel: 'newsletter', format: 'email' },
    label: 'Blog → Newsletter email',
  },
  {
    transform_type: 'blog_to_script_short',
    prompt_profile: 'video_short',
    source: { channel: 'website', format: 'blog' },
    target: { channel: 'short_video', format: 'video_script' },
    label: 'Blog → Short video script',
  },
  {
    transform_type: 'blog_to_carousel',
    prompt_profile: 'social_fb_carousel',
    source: { channel: 'website', format: 'blog' },
    target: { channel: 'facebook', format: 'carousel' },
    label: 'Blog → Facebook carousel',
  },
];

const REPURPOSE_SOURCE_STATUSES = new Set([
  'approved_internal',
  'scheduled',
  'published',
  'pending_client',
  'client_approved',
]);

export function assertRepurposeSource(item: CmktItemRow): void {
  if (item.channel !== 'website' || item.format !== 'blog') {
    throw new BadRequestException({
      error: 'repurpose_source_invalid',
      message: 'Chỉ repurpose từ item website/blog.',
      channel: item.channel,
      format: item.format,
    });
  }
  if (!REPURPOSE_SOURCE_STATUSES.has(item.status)) {
    throw new BadRequestException({
      error: 'repurpose_source_not_approved',
      message: 'Blog master phải được duyệt (approved_internal) trước khi repurpose.',
      status: item.status,
    });
  }
  const md = String(item.body_json?.markdown ?? '').trim();
  if (!md) {
    throw new BadRequestException({
      error: 'repurpose_source_empty',
      message: 'Blog master cần có nội dung body.',
    });
  }
}

export function resolveRepurposeTransform(
  source: CmktItemRow,
  target: CmktRepurposeTarget,
): CmktRepurposeTransform {
  const channel = String(target.channel ?? '').trim();
  const format = String(target.format ?? '').trim();
  const hit = CMKT_REPURPOSE_TRANSFORMS.find(
    (t) =>
      t.source.channel === source.channel &&
      t.source.format === source.format &&
      t.target.channel === channel &&
      t.target.format === format,
  );
  if (!hit) {
    throw new BadRequestException({
      error: 'repurpose_target_unsupported',
      channel,
      format,
      supported: CMKT_REPURPOSE_TRANSFORMS.map((t) => ({
        channel: t.target.channel,
        format: t.target.format,
        transform_type: t.transform_type,
      })),
    });
  }
  return hit;
}

export function normalizeRepurposeCount(count: unknown): number {
  const n = count != null ? Number(count) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 5);
}
