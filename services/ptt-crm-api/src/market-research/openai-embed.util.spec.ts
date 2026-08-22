import { fetchOpenAIEmbedding, l2Normalize } from './openai-embed.util';

describe('l2Normalize', () => {
  it('normalizes a vector to unit length', () => {
    const out = l2Normalize([3, 4, 0]);
    expect(out[0]).toBeCloseTo(0.6);
    expect(out[1]).toBeCloseTo(0.8);
    expect(out[2]).toBeCloseTo(0);
  });
});

describe('fetchOpenAIEmbedding', () => {
  it('fetchOpenAIEmbedding posts model+input and L2-normalizes', async () => {
    const transport = async () => ({
      status: 200,
      json: async () => ({ data: [{ embedding: [3, 4, 0] }] }),
    });
    const out = await fetchOpenAIEmbedding(
      { text: 'Giá sữa học đường', apiKey: 'sk-test', dims: 3 },
      transport,
    );
    expect(out.dims).toBe(3);
    expect(out.model).toBe('text-embedding-3-small');
    expect(out.embedding[0]).toBeCloseTo(0.6);
    expect(out.embedding[1]).toBeCloseTo(0.8);
  });

  it('HTTP 401 throws openai_embed_failed', async () => {
    await expect(
      fetchOpenAIEmbedding(
        { text: 'x', apiKey: 'bad' },
        async () => ({ status: 401, json: async () => ({}) }),
      ),
    ).rejects.toMatchObject({ code: 'openai_embed_failed' });
  });
});
