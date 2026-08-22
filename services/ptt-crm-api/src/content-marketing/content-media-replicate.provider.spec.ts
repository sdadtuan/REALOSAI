import { ReplicateMediaProvider } from './content-media-replicate.provider';

describe('ReplicateMediaProvider', () => {
  const config = {
    replicateApiToken: 'test-token',
    contentMarketingImageModel: 'black-forest-labs/flux-schnell',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads image when prediction succeeds synchronously', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pred-1',
          status: 'succeeded',
          output: ['https://replicate.delivery/out-1.webp'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      });
    global.fetch = fetchMock as typeof fetch;

    const provider = new ReplicateMediaProvider(config as never);
    const rows = await provider.generateImages({
      lifecycleId: 1,
      itemId: 2,
      variantCount: 1,
      aspectRatio: '1:1',
      stylePreset: 'corporate',
      title: 'Test',
      approvedCopy: 'Body copy',
      draftWatermark: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].providerRequestId).toBe('pred-1');
    expect(Buffer.isBuffer(rows[0].buffer)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/predictions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when token missing', async () => {
    const provider = new ReplicateMediaProvider({ replicateApiToken: '' } as never);
    await expect(
      provider.generateImages({
        lifecycleId: 1,
        itemId: 2,
        variantCount: 1,
        aspectRatio: '1:1',
        stylePreset: 'corporate',
        title: 'Test',
        approvedCopy: 'Body',
        draftWatermark: false,
      }),
    ).rejects.toThrow('replicate_token_missing');
  });
});
