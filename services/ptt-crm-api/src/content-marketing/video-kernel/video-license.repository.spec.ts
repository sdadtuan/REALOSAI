import { BadRequestException } from '@nestjs/common';
import { VideoLicenseRepository } from './video-license.repository';

describe('VideoLicenseRepository', () => {
  const db = { query: jest.fn() };
  const repo = new VideoLicenseRepository(db as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('insertLicense includes asset_kind with a valid kind in INSERT SQL', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          lifecycle_id: 10,
          item_id: 20,
          asset_kind: 'stock_clip',
          provider: 'pexels',
          provider_id: 'abc123',
          license_name: 'pexels_license',
          source_url: 'https://pexels.com/v/abc123',
          local_storage_key: 'cmkt/video/abc123.mp4',
          created_at: '2026-08-20T00:00:00.000Z',
        },
      ],
    });

    await repo.insertLicense({
      lifecycleId: 10,
      itemId: 20,
      assetKind: 'stock_clip',
      provider: 'pexels',
      providerId: 'abc123',
      licenseName: 'pexels_license',
      sourceUrl: 'https://pexels.com/v/abc123',
      localStorageKey: 'cmkt/video/abc123.mp4',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/asset_kind/i);
    expect(sql).toMatch(/INSERT\s+INTO\s+cmkt_video_licenses/i);
    expect(params).toContain('stock_clip');
  });

  it('rejects invalid assetKind', async () => {
    await expect(
      repo.insertLicense({
        lifecycleId: 10,
        itemId: 20,
        assetKind: 'invalid_kind' as never,
        provider: 'pexels',
        providerId: null,
        licenseName: 'pexels_license',
        sourceUrl: null,
        localStorageKey: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('listByItem queries by item_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await repo.listByItem(20);

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM\s+cmkt_video_licenses/i);
    expect(sql).toMatch(/item_id/i);
    expect(params).toEqual([20]);
  });
});
