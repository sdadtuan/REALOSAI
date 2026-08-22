import {
  fetchTalkwalkerSearchResults,
  normalizeTalkwalkerSearchResponse,
  TALKWALKER_DEFAULT_BASE,
  TALKWALKER_RESULT_LIMIT,
} from './talkwalker-client.util';

describe('talkwalker-client.util', () => {
  const sample = {
    results: [
      {
        url: 'https://news.example/live-mention',
        title: 'Live mention title',
        content: 'Public conversation about pricing.',
        source_name: 'example-news',
      },
    ],
  };

  it('P36 normalizeTalkwalkerSearchResponse maps url/title/content', () => {
    const out = normalizeTalkwalkerSearchResponse(sample);
    expect(out.results[0]).toMatchObject({
      url: 'https://news.example/live-mention',
      title: 'Live mention title',
      snippet: 'Public conversation about pricing.',
      source_name: 'example-news',
    });
  });

  it('P36 fetchTalkwalkerSearchResults calls Talkwalker search API', async () => {
    const transport = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => sample,
    });
    const out = await fetchTalkwalkerSearchResults(
      {
        query: 'sữa uống giá',
        accessToken: 'tw-token',
        projectId: 'proj-abc',
        limit: 5,
      },
      transport,
    );
    expect(out.results).toHaveLength(1);
    const calledUrl = String(transport.mock.calls[0][0].url);
    expect(calledUrl).toMatch(`${TALKWALKER_DEFAULT_BASE}/api/v1/search/p/`);
    expect(calledUrl).toMatch(/proj-abc/);
    expect(calledUrl).toMatch(/access_token=/);
    expect(calledUrl).toMatch(/q=/);
    expect(calledUrl).toMatch(/proj-abc/);
  });

  it('P36 fetchTalkwalkerSearchResults throws on non-2xx', async () => {
    const transport = jest.fn().mockResolvedValue({ status: 401, json: async () => ({}) });
    await expect(
      fetchTalkwalkerSearchResults(
        { query: 'x', accessToken: 't', projectId: 'p' },
        transport,
      ),
    ).rejects.toThrow('talkwalker_search_http_401');
  });

  it('P36 normalizeTalkwalkerSearchResponse caps at limit', () => {
    const many = {
      results: Array.from({ length: 20 }, (_, i) => ({
        url: `https://ex/${i}`,
        title: `t${i}`,
        snippet: 's',
      })),
    };
    expect(normalizeTalkwalkerSearchResponse(many, TALKWALKER_RESULT_LIMIT).results).toHaveLength(
      TALKWALKER_RESULT_LIMIT,
    );
  });
});
