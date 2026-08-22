import { SPARKTORO_LIMITATION_NOTE, mapSparkToroResponse } from './sparktoro-mapper.util';

describe('mapSparkToroResponse', () => {
  const fixture = {
    results: [
      {
        url: 'https://sparktoro.com/audience/sua-uong',
        title: 'Audience overlap sữa uống',
        snippet: 'Ước lượng overlap audience ngành sữa uống tại VN.',
      },
    ],
  };

  it('M3-1c: mapper does not emit statement or insight fields', () => {
    const out = mapSparkToroResponse(fixture);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      url: 'https://sparktoro.com/audience/sua-uong',
      title: 'Audience overlap sữa uống',
      publisher: 'SparkToro',
      reliability_tier: 'medium',
      limitation_note: SPARKTORO_LIMITATION_NOTE,
      snippet: 'Ước lượng overlap audience ngành sữa uống tại VN.',
    });
    const raw = JSON.stringify(out);
    expect(raw).not.toContain('statement');
    expect(raw).not.toContain('observation');
    expect(raw).not.toContain('interpretation');
    expect(raw).not.toContain('implication');
    expect(raw).not.toContain('recommendation');
    for (const row of out) {
      expect(row).not.toHaveProperty('statement');
      expect(Object.keys(row).sort()).toEqual(
        ['limitation_note', 'publisher', 'reliability_tier', 'snippet', 'title', 'url'].sort(),
      );
    }
  });

  it('drops a row when snippet has an email (piiHint)', () => {
    const out = mapSparkToroResponse({
      results: [
        {
          url: 'https://sparktoro.com/ok',
          title: 'Clean',
          snippet: 'No PII here',
        },
        {
          url: 'https://sparktoro.com/pii',
          title: 'Leak',
          snippet: 'Contact analyst@ptt.vn for the table',
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://sparktoro.com/ok');
  });

  it('caps snippet at 500 characters', () => {
    const out = mapSparkToroResponse({
      results: [
        {
          url: 'https://sparktoro.com/long',
          title: 'Long',
          snippet: 'x'.repeat(800),
        },
      ],
    });
    expect(out[0].snippet.length).toBe(500);
  });
});
