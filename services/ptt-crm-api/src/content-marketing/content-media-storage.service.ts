import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

export type CmktMediaUploadInput = {
  lifecycleId: number;
  itemId: number;
  assetId: string;
  buffer: Buffer;
  contentType: string;
};

export type CmktMediaUploadResult = {
  url: string;
  storageKey: string;
};

@Injectable()
export class ContentMediaStorageService {
  private readonly logger = new Logger(ContentMediaStorageService.name);

  constructor(private readonly config: AppConfigService) {}

  get cdnBase(): string {
    return this.config.contentMarketingCdnBase.replace(/\/$/, '');
  }

  buildStorageKey(lifecycleId: number, itemId: number, assetId: string, ext = 'webp'): string {
    const safeId = assetId.replace(/\.(webp|mp4|json)$/i, '');
    return `${lifecycleId}/${itemId}/${safeId}.${ext}`;
  }

  buildPublicUrl(storageKey: string): string {
    return `${this.cdnBase}/${storageKey}`;
  }

  async uploadAsset(input: CmktMediaUploadInput & { fileExt?: string }): Promise<CmktMediaUploadResult> {
    const ext =
      input.fileExt ??
      (input.contentType.includes('json')
        ? 'json'
        : input.contentType.includes('mp4')
          ? 'mp4'
          : 'webp');
    const storageKey = this.buildStorageKey(input.lifecycleId, input.itemId, input.assetId, ext);
    const bucket = this.config.contentMarketingS3Bucket;
    const hasS3 =
      bucket &&
      this.config.awsAccessKeyId &&
      this.config.awsSecretAccessKey;

    if (hasS3) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const client = new S3Client({
          region: this.config.awsRegion,
          credentials: {
            accessKeyId: this.config.awsAccessKeyId,
            secretAccessKey: this.config.awsSecretAccessKey,
          },
        });
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: input.buffer,
            ContentType: input.contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        return { url: this.buildPublicUrl(storageKey), storageKey };
      } catch (err) {
        this.logger.warn(
          `S3 upload failed for ${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { url: this.buildPublicUrl(storageKey), storageKey };
  }
}
