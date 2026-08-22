import {
  mergeUploadedPart,
  partsPendingUpload,
  TopazVideoGen,
  topazCancelCreditsKept,
  type TopazSagaState,
} from './topaz.video';

describe('partsPendingUpload', () => {
  it('skips parts that already have eTag when resuming step 3', () => {
    const saga: TopazSagaState = {
      step: 3,
      request_id: 'req-1',
      parts: [{ partNum: 1, eTag: 'etag-1' }],
    };
    const pending = partsPendingUpload(saga, [
      { partNum: 1, uploadUrl: 'https://u/1', body: Buffer.from('a') },
      { partNum: 2, uploadUrl: 'https://u/2', body: Buffer.from('b') },
    ]);
    expect(pending.map((p) => p.partNum)).toEqual([2]);
  });
});

describe('mergeUploadedPart', () => {
  it('records eTag and advances step', () => {
    const next = mergeUploadedPart({ step: 2, parts: [] }, 1, 'etag-1');
    expect(next.parts).toEqual([{ partNum: 1, eTag: 'etag-1' }]);
    expect(next.step).toBeGreaterThanOrEqual(3);
  });
});

describe('topazCancelCreditsKept', () => {
  it('returns 55 at 50% progress', () => {
    expect(topazCancelCreditsKept(50)).toBeCloseTo(55, 5);
  });
});

describe('TopazVideoGen.runSaga resume from step 3', () => {
  it('does not re-upload part 1 when eTag exists', async () => {
    const uploads: number[] = [];
    const gen = new TopazVideoGen({
      apiKey: 'key',
      fetchImpl: jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/complete-upload/')) {
          return { ok: true, json: async () => ({ ok: true }) } as Response;
        }
        throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
      }),
      uploadPart: async (_url, body) => {
        uploads.push(body.length);
        return { eTag: 'etag-2' };
      },
    });

    const saga: TopazSagaState = {
      step: 3,
      request_id: 'req-1',
      parts: [{ partNum: 1, eTag: 'etag-1' }],
    };

    const result = await gen.runSaga({
      inputPath: '/tmp/in.mp4',
      probe: { hasVideo: true, hasAudio: true, durationSec: 10, lufs: null },
      saga,
      partsPlan: [
        { partNum: 1, uploadUrl: 'https://u/1', body: Buffer.from('a') },
        { partNum: 2, uploadUrl: 'https://u/2', body: Buffer.from('bb') },
      ],
    });

    expect(uploads).toEqual([2]);
    expect(result.step).toBe(5);
    expect(result.parts).toEqual([
      { partNum: 1, eTag: 'etag-1' },
      { partNum: 2, eTag: 'etag-2' },
    ]);
  });
});
