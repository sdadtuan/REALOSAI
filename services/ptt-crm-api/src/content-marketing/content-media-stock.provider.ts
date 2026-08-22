import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppConfigService } from '../config/app-config.service';

export type CmktStockClip = {
  id: string;
  url: string;
  poster_url: string;
  duration_sec: number;
  provider: string;
  keyword: string;
};

@Injectable()
export class ContentMediaStockProvider {
  private readonly logger = new Logger(ContentMediaStockProvider.name);

  constructor(private readonly config: AppConfigService) {}

  get providerName(): string {
    return this.config.contentMarketingStockProvider || 'stub';
  }

  async fetchClips(script: string, maxClips = 3): Promise<CmktStockClip[]> {
    const keywords = extractClipKeywords(script);
    const provider = this.providerName;
    const apiKey = this.config.contentMarketingStockApiKey;

    if (provider === 'pexels' && apiKey) {
      try {
        const clips: CmktStockClip[] = [];
        for (const keyword of keywords.slice(0, maxClips)) {
          const response = await fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=portrait`,
            { headers: { Authorization: apiKey } },
          );
          if (!response.ok) continue;
          const payload = (await response.json()) as {
            videos?: Array<{
              id: number;
              duration: number;
              video_files?: Array<{ link: string; width: number; height: number }>;
              image?: string;
            }>;
          };
          const video = payload.videos?.[0];
          const file =
            video?.video_files?.sort((a, b) => b.height - a.height)[0] ??
            video?.video_files?.[0];
          if (!video || !file) continue;
          clips.push({
            id: String(video.id),
            url: file.link,
            poster_url: video.image ?? file.link,
            duration_sec: Math.min(15, Math.max(3, video.duration ?? 8)),
            provider: 'pexels',
            keyword,
          });
        }
        if (clips.length) return clips;
      } catch (err) {
        this.logger.warn(`Pexels stock fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return keywords.slice(0, maxClips).map((keyword, idx) => {
      const hash = createHash('sha256').update(`${keyword}:${idx}`).digest('hex').slice(0, 10);
      const base = this.config.contentMarketingCdnBase.replace(/\/$/, '');
      return {
        id: `stub-${hash}`,
        url: `${base}/stock/${hash}.mp4`,
        poster_url: `${base}/stock/${hash}-poster.webp`,
        duration_sec: 8,
        provider: 'stub',
        keyword,
      };
    });
  }
}

export function extractClipKeywords(script: string): string[] {
  const stop = new Set(['và', 'của', 'cho', 'với', 'the', 'and', 'for', 'from', 'your', 'bài', 'video']);
  const words = script
    .toLowerCase()
    .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s-]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));
  const unique = [...new Set(words)];
  if (!unique.length) return ['business', 'marketing', 'team'];
  return unique;
}
