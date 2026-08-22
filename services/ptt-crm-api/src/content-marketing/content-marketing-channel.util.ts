import { BadRequestException } from '@nestjs/common';
import type { CmktChannel, CmktFormat } from './content-marketing.types';

const CHANNEL_FORMATS: Record<CmktChannel, readonly CmktFormat[]> = {
  website: ['blog'],
  facebook: ['social_post', 'carousel'],
  linkedin: ['social_post', 'carousel'],
  short_video: ['video_script'],
  youtube: ['video_script'],
  newsletter: ['email'],
  drip: ['email'],
  zalo_oa: ['social_post'],
  meta_ads: ['ad_copy'],
  google_ads: ['ad_copy'],
  document: ['blog'],
};

export function listFormatsForChannel(channel: string): CmktFormat[] {
  const key = channel as CmktChannel;
  return [...(CHANNEL_FORMATS[key] ?? [])];
}

export function isValidChannelFormat(channel: string, format: string): boolean {
  return listFormatsForChannel(channel).includes(format as CmktFormat);
}

export function assertValidChannelFormat(channel: string, format: string): void {
  if (!isValidChannelFormat(channel, format)) {
    throw new BadRequestException({
      error: 'CMKT_INVALID_CHANNEL_FORMAT',
      channel,
      format,
      allowed_formats: listFormatsForChannel(channel),
    });
  }
}

export const CMKT_P0_CHANNEL_FORMAT_PAIRS: ReadonlyArray<{
  channel: CmktChannel;
  format: CmktFormat;
  label: string;
}> = [
  { channel: 'website', format: 'blog', label: 'Website / Blog' },
  { channel: 'facebook', format: 'social_post', label: 'Facebook — bài viết' },
  { channel: 'facebook', format: 'carousel', label: 'Facebook — carousel' },
  { channel: 'linkedin', format: 'social_post', label: 'LinkedIn — bài viết' },
  { channel: 'linkedin', format: 'carousel', label: 'LinkedIn — carousel' },
];
