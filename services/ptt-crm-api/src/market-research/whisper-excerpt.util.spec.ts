import { assertNoRawInPayload, excerptsFromTranscript } from './whisper-excerpt.util';

describe('excerptsFromTranscript', () => {
  it('M1-1a: 3 short sentences become 3 excerpts ≤ 500 with T-mm:ss locators', () => {
    const text = 'First sentence is short. Second sentence is also short. Third sentence wraps it up.';
    const excerpts = excerptsFromTranscript(text);

    expect(excerpts).toHaveLength(3);
    for (const row of excerpts) {
      expect(row.excerpt.length).toBeGreaterThan(0);
      expect(row.excerpt.length).toBeLessThanOrEqual(500);
      expect(row.locator).toMatch(/^T-\d{1,2}:\d{2}/);
    }
    expect(excerpts.map((row) => row.excerpt).join(' ')).not.toContain('transcript');
    expect(excerpts.every((row) => !('text' in row) && !('transcript' in row))).toBe(true);
  });

  it('M1-1b: 20k-char dump yields no excerpt > 500 and at most 12 rows', () => {
    const text = 'x'.repeat(20_000);
    const excerpts = excerptsFromTranscript(text);

    expect(excerpts.length).toBeGreaterThan(0);
    expect(excerpts.length).toBeLessThanOrEqual(12);
    for (const row of excerpts) {
      expect(row.excerpt.length).toBeLessThanOrEqual(500);
      expect(row.locator).toMatch(/^T-\d{1,2}:\d{2}/);
    }
  });
});

describe('assertNoRawInPayload', () => {
  it('M1-1c: payload with a 9000-char transcript is raw_transcript_forbidden', () => {
    expect(() => assertNoRawInPayload({ transcript: 'x'.repeat(9000) })).toThrow(
      'raw_transcript_forbidden',
    );
    try {
      assertNoRawInPayload({ transcript: 'x'.repeat(9000) });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('raw_transcript_forbidden');
    }
  });
});
