import { VdReviewService } from './vd-review.service';

describe('VdReviewService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;

  it('rejects ttl_days > 14', async () => {
    const service = new VdReviewService(
      config,
      { getById: jest.fn() } as never,
      { getById: jest.fn() } as never,
      { getStatusMap: jest.fn() } as never,
      { insertLink: jest.fn() } as never,
    );
    await expect(
      service.createLink({ project_id: 1, gate_no: 4, asset_ids: [1], ttl_days: 15 }),
    ).rejects.toThrow('ttl_exceeded');
  });

  it('returns review_expired for past expires_at', async () => {
    const service = new VdReviewService(
      config,
      { getById: jest.fn() } as never,
      { getById: jest.fn().mockResolvedValue({ id: 1, url: 'x', storage_key: 'x' }) } as never,
      { getStatusMap: jest.fn() } as never,
      {
        getByToken: jest.fn().mockResolvedValue({
          id: 1,
          token: 'abc',
          project_id: 1,
          gate_no: 4,
          asset_ids: [1],
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          watermark_label: 'PTT',
          created_at: new Date().toISOString(),
        }),
        listComments: jest.fn(),
      } as never,
    );
    await expect(service.getPublicReview('abc')).rejects.toThrow('review_expired');
  });

  it('creates link with ttl_days=14', async () => {
    const insertLink = jest.fn().mockResolvedValue({
      id: 2,
      token: 'tok',
      project_id: 1,
      gate_no: 4,
      asset_ids: [3],
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      watermark_label: 'PTT Review',
      created_at: new Date().toISOString(),
    });
    const service = new VdReviewService(
      config,
      { getById: jest.fn().mockResolvedValue({ id: 1 }) } as never,
      { getById: jest.fn().mockResolvedValue({ id: 3, project_id: 1, url: 'v' }) } as never,
      { getStatusMap: jest.fn() } as never,
      { insertLink, listComments: jest.fn() } as never,
    );
    const row = await service.createLink({
      project_id: 1,
      gate_no: 4,
      asset_ids: [3],
      ttl_days: 14,
    });
    expect(row.token).toBe('tok');
    expect(row.portal_path).toContain('/video-review/');
  });
});
