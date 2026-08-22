import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentMediaAssetCacheService {
  private readonly cleanBuffers = new Map<string, Buffer>();

  private key(lifecycleId: number, itemId: number, assetId: string): string {
    return `${lifecycleId}:${itemId}:${assetId}`;
  }

  putCleanBuffer(lifecycleId: number, itemId: number, assetId: string, buffer: Buffer): void {
    this.cleanBuffers.set(this.key(lifecycleId, itemId, assetId), buffer);
  }

  getCleanBuffer(lifecycleId: number, itemId: number, assetId: string): Buffer | null {
    return this.cleanBuffers.get(this.key(lifecycleId, itemId, assetId)) ?? null;
  }

  deleteCleanBuffer(lifecycleId: number, itemId: number, assetId: string): void {
    this.cleanBuffers.delete(this.key(lifecycleId, itemId, assetId));
  }
}
