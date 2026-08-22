import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ContentMediaAssetCacheService } from './content-media-asset-cache.service';
import { ContentMediaStorageService } from './content-media-storage.service';
import type { CmktMediaAsset, CmktMediaJson } from './content-marketing.types';
import { SocialVideoService } from './video-social/social-video.service';

@Injectable()
export class ContentMediaCleanService {
  constructor(
    private readonly storage: ContentMediaStorageService,
    private readonly cache: ContentMediaAssetCacheService,
    @Inject(forwardRef(() => SocialVideoService))
    private readonly socialVideo: SocialVideoService,
  ) {}

  promoteAsset(asset: CmktMediaAsset, lifecycleId: number, itemId: number): CmktMediaAsset {
    if (!asset.draft_watermark && !asset.clean_storage_key) return asset;

    const cleanKey = asset.clean_storage_key;
    const cleanUrl = cleanKey ? this.storage.buildPublicUrl(cleanKey) : asset.url.replace(/\?draft=1/, '');

    this.cache.deleteCleanBuffer(lifecycleId, itemId, asset.id);

    return {
      ...asset,
      url: cleanUrl,
      draft_watermark: false,
      storage_key: cleanKey ?? asset.storage_key,
    };
  }

  async promoteMediaJson(
    media: CmktMediaJson,
    lifecycleId: number,
    itemId: number,
  ): Promise<CmktMediaJson> {
    const promoteList = (assets?: CmktMediaAsset[]) =>
      assets?.map((a) => this.promoteAsset(a, lifecycleId, itemId));

    const next: CmktMediaJson = { ...media };
    if (media.ai_assets?.length) next.ai_assets = promoteList(media.ai_assets);
    if (media.carousel_slides?.length) next.carousel_slides = promoteList(media.carousel_slides);
    if (media.video_short) {
      next.video_short = await this.promoteVideoShort(media.video_short, media, lifecycleId, itemId);
      if (next.video_short && next.ai_assets?.length) {
        const clean = next.video_short;
        next.ai_assets = next.ai_assets.map((a) =>
          a.id === clean.id
            ? {
                ...a,
                url: clean.url,
                storage_key: clean.storage_key,
                clean_storage_key: clean.clean_storage_key,
                draft_watermark: clean.draft_watermark,
                poster_url: clean.poster_url,
              }
            : a,
        );
      }
    }

    const selectedId = next.selected_asset_id;
    if (selectedId) {
      const selected = [...(next.ai_assets ?? []), ...(next.carousel_slides ?? [])].find(
        (a) => a.id === selectedId,
      );
      if (selected) next.selected_asset_id = selected.id;
    }
    return next;
  }

  private async promoteVideoShort(
    asset: CmktMediaAsset,
    media: CmktMediaJson,
    lifecycleId: number,
    itemId: number,
  ): Promise<CmktMediaAsset> {
    if (!asset.draft_watermark && !asset.clean_storage_key) return asset;

    const isSocialVideo =
      asset.type === 'video' && (media.video_studio === 'social' || Boolean(media.storyboard));

    if (isSocialVideo) {
      if (media.storyboard) {
        const recomposed = await this.socialVideo.composeCleanMaster(
          lifecycleId,
          itemId,
          media.storyboard,
          asset,
        );
        if (recomposed) {
          this.cache.deleteCleanBuffer(lifecycleId, itemId, asset.id);
          return recomposed;
        }
      }
      return asset;
    }

    return this.promoteAsset(asset, lifecycleId, itemId);
  }
}
