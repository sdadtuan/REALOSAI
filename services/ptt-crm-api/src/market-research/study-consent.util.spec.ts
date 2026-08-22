import {
  assertConsentHasNoPii,
  assertExcerptNotRawTranscript,
  assertStudyIngestable,
  assertTranscriptLocator,
  defaultConsentExpiry,
} from './study-consent.util';

describe('assertTranscriptLocator', () => {
  it('accepts locator T-12:03', () => {
    expect(() => assertTranscriptLocator('T-12:03')).not.toThrow();
  });
});

describe('assertExcerptNotRawTranscript', () => {
  it('throws raw_transcript_forbidden for an 800-char excerpt', () => {
    const excerpt = 'full interview dump '.repeat(40).slice(0, 800);
    expect(excerpt.length).toBe(800);
    expect(() => assertExcerptNotRawTranscript(excerpt)).toThrow('raw_transcript_forbidden');
    try {
      assertExcerptNotRawTranscript(excerpt);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('raw_transcript_forbidden');
    }
  });
});

describe('assertConsentHasNoPii', () => {
  it('throws consent_pii_forbidden when notes contain 0909123456', () => {
    expect(() =>
      assertConsentHasNoPii({ subject_code: 'R-004', notes: 'gọi 0909123456' }),
    ).toThrow('consent_pii_forbidden');
    try {
      assertConsentHasNoPii({ subject_code: 'R-004', notes: 'gọi 0909123456' });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('consent_pii_forbidden');
    }
  });
});

describe('defaultConsentExpiry', () => {
  it('returns recorded_at plus 24 months', () => {
    const recorded = new Date('2026-08-14T00:00:00.000Z');
    const expiry = defaultConsentExpiry(recorded);
    expect(expiry.getUTCFullYear()).toBe(2028);
    expect(expiry.getUTCMonth()).toBe(recorded.getUTCMonth());
    expect(expiry.getUTCDate()).toBe(recorded.getUTCDate());
  });
});

describe('assertStudyIngestable', () => {
  const now = new Date('2026-08-14T12:00:00.000Z');

  it('throws consent_required when there are no consents', () => {
    expect(() => assertStudyIngestable([], now)).toThrow('consent_required');
    try {
      assertStudyIngestable([], now);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('consent_required');
    }
  });

  it('throws consent_expired when every consent has expired', () => {
    expect(() =>
      assertStudyIngestable([{ expires_at: '2026-08-14T11:59:59.000Z' }], now),
    ).toThrow('consent_expired');
    try {
      assertStudyIngestable([{ expires_at: '2026-08-14T11:59:59.000Z' }], now);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('consent_expired');
    }
  });

  it('accepts a study with at least one unexpired consent', () => {
    expect(() =>
      assertStudyIngestable(
        [
          { expires_at: '2026-08-13T00:00:00.000Z' },
          { expires_at: '2026-08-15T00:00:00.000Z' },
        ],
        now,
      ),
    ).not.toThrow();
  });
});
