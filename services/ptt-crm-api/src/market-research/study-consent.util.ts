const PHONE = /(?:\+?84|0)\d{8,10}\b/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const TRANSCRIPT_LOCATOR = /^(T-\d{1,2}:\d{2}(?::\d{2})?|[^\s]+#t=\d+|https?:\/\/\S+)$/i;

export function assertTranscriptLocator(locator: string): void {
  const s = String(locator ?? '').trim();
  if (!TRANSCRIPT_LOCATOR.test(s)) {
    throw Object.assign(new Error('invalid_transcript_locator'), { code: 'invalid_transcript_locator' });
  }
}

export function assertExcerptNotRawTranscript(excerpt: string | null | undefined): void {
  const s = String(excerpt ?? '');
  if (s.length > 500) {
    throw Object.assign(new Error('raw_transcript_forbidden'), { code: 'raw_transcript_forbidden' });
  }
}

export function assertConsentHasNoPii(input: { subject_code?: string; notes?: string | null }): void {
  const hay = `${input.subject_code ?? ''} ${input.notes ?? ''}`;
  if (PHONE.test(hay) || EMAIL.test(hay)) {
    throw Object.assign(new Error('consent_pii_forbidden'), { code: 'consent_pii_forbidden' });
  }
}

export function defaultConsentExpiry(recordedAt: Date, now = recordedAt): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 24);
  return d;
}

export function assertStudyIngestable(
  consents: Array<{ expires_at: string | Date }>,
  now: Date,
): void {
  if (!consents.length) {
    throw Object.assign(new Error('consent_required'), { code: 'consent_required' });
  }
  const fresh = consents.some((row) => new Date(row.expires_at).getTime() > now.getTime());
  if (!fresh) {
    throw Object.assign(new Error('consent_expired'), { code: 'consent_expired' });
  }
}
