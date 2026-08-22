import { BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';

export const CMKT_VIDEO_LICENSE_ASSET_KINDS = [
  'stock_clip',
  'music_bed',
  'tts',
  'logo',
  'upload',
] as const;

export type CmktVideoLicenseAssetKind = (typeof CMKT_VIDEO_LICENSE_ASSET_KINDS)[number];

export type InsertVideoLicenseInput = {
  lifecycleId: number;
  itemId: number;
  assetKind: CmktVideoLicenseAssetKind;
  provider: string;
  providerId: string | null;
  licenseName: string;
  sourceUrl: string | null;
  localStorageKey: string | null;
};

export type CmktVideoLicenseRow = {
  id: number;
  lifecycle_id: number;
  item_id: number;
  asset_kind: CmktVideoLicenseAssetKind;
  provider: string;
  provider_id: string | null;
  license_name: string;
  source_url: string | null;
  local_storage_key: string | null;
  created_at: string;
};

function isAssetKind(value: string): value is CmktVideoLicenseAssetKind {
  return (CMKT_VIDEO_LICENSE_ASSET_KINDS as readonly string[]).includes(value);
}

function mapRow(row: Record<string, unknown>): CmktVideoLicenseRow {
  return {
    id: Number(row.id),
    lifecycle_id: Number(row.lifecycle_id),
    item_id: Number(row.item_id),
    asset_kind: String(row.asset_kind) as CmktVideoLicenseAssetKind,
    provider: String(row.provider ?? ''),
    provider_id: row.provider_id != null ? String(row.provider_id) : null,
    license_name: String(row.license_name ?? ''),
    source_url: row.source_url != null ? String(row.source_url) : null,
    local_storage_key: row.local_storage_key != null ? String(row.local_storage_key) : null,
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

export class VideoLicenseRepository {
  constructor(private readonly db: Pool) {}

  async insertLicense(input: InsertVideoLicenseInput): Promise<CmktVideoLicenseRow> {
    const assetKind = String(input.assetKind ?? '');
    if (!isAssetKind(assetKind)) {
      throw new BadRequestException(
        `asset_kind must be one of: ${CMKT_VIDEO_LICENSE_ASSET_KINDS.join(', ')}`,
      );
    }

    const result = await this.db.query(
      `INSERT INTO cmkt_video_licenses (
         lifecycle_id, item_id, asset_kind, provider, provider_id,
         license_name, source_url, local_storage_key
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.lifecycleId,
        input.itemId,
        assetKind,
        input.provider,
        input.providerId,
        input.licenseName,
        input.sourceUrl,
        input.localStorageKey,
      ],
    );

    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async listByItem(itemId: number): Promise<CmktVideoLicenseRow[]> {
    const result = await this.db.query(
      `SELECT *
       FROM cmkt_video_licenses
       WHERE item_id = $1
       ORDER BY id ASC`,
      [itemId],
    );

    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }
}
