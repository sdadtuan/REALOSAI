import { TALKWALKER_LIMITATION_NOTE, mapTalkwalkerResponse } from './talkwalker-mapper.util';
import { TALKWALKER_STUB_RESULTS } from './talkwalker-stub.util';

describe('mapTalkwalkerResponse', () => {
  it('P23 maps stub results to Talkwalker sources with limitation', () => {
    const out = mapTalkwalkerResponse(TALKWALKER_STUB_RESULTS);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]).toMatchObject({
      publisher: 'Talkwalker',
      reliability_tier: 'medium',
      limitation_note: TALKWALKER_LIMITATION_NOTE,
    });
    expect(out[0].url).toMatch(/^https?:\/\//);
    expect(out[0].snippet.length).toBeLessThanOrEqual(500);
  });

  it('P23 drops rows with PII snippet', () => {
    const out = mapTalkwalkerResponse({
      results: [
        { url: 'https://news.example/a', title: 'A', snippet: 'Liên hệ 0901234567' },
        { url: 'https://news.example/b', title: 'B', snippet: 'Công khai không PII' },
      ],
    });
    expect(out.map((r) => r.title)).toEqual(['B']);
  });

  it('P23 skips rows missing url or title', () => {
    expect(mapTalkwalkerResponse({ results: [{ url: '', title: 'X', snippet: 'y' }] })).toEqual([]);
  });
});
