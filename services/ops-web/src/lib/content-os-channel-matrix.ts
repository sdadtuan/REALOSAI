/** Channel × format matrix (mirrors BE content-marketing-channel.util). */

export type ContentOsChannelOption = {
  channel: string;
  format: string;
  label: string;
};

export const CMKT_CHANNEL_OPTIONS: ContentOsChannelOption[] = [
  { channel: 'website', format: 'blog', label: 'Website — Blog' },
  { channel: 'facebook', format: 'social_post', label: 'Facebook — Bài viết' },
  { channel: 'facebook', format: 'carousel', label: 'Facebook — Carousel' },
  { channel: 'linkedin', format: 'social_post', label: 'LinkedIn — Bài viết' },
  { channel: 'linkedin', format: 'carousel', label: 'LinkedIn — Carousel' },
  { channel: 'short_video', format: 'video_script', label: 'Short video — Script' },
  { channel: 'youtube', format: 'video_script', label: 'YouTube — Script' },
  { channel: 'newsletter', format: 'email', label: 'Newsletter — Email' },
  { channel: 'drip', format: 'email', label: 'Drip — Email' },
  { channel: 'zalo_oa', format: 'social_post', label: 'Zalo OA — Bài viết' },
  { channel: 'meta_ads', format: 'ad_copy', label: 'Meta Ads — Ad copy' },
  { channel: 'google_ads', format: 'ad_copy', label: 'Google Ads — Ad copy' },
  { channel: 'document', format: 'blog', label: 'Document — Blog' },
];

export function formatsForChannel(channel: string): ContentOsChannelOption[] {
  return CMKT_CHANNEL_OPTIONS.filter((o) => o.channel === channel);
}

export function channelLabels(): { channel: string; label: string }[] {
  const seen = new Set<string>();
  const out: { channel: string; label: string }[] = [];
  for (const o of CMKT_CHANNEL_OPTIONS) {
    if (seen.has(o.channel)) continue;
    seen.add(o.channel);
    const base = o.label.split(' — ')[0] ?? o.channel;
    out.push({ channel: o.channel, label: base });
  }
  return out;
}
