import { mapHttpToErrorClass, ProviderError } from './provider-error';

describe('mapHttpToErrorClass', () => {
  it('maps 401 and 403 to auth', () => {
    expect(mapHttpToErrorClass(401)).toBe('auth');
    expect(mapHttpToErrorClass(403)).toBe('auth');
  });

  it('maps 400 to validation', () => {
    expect(mapHttpToErrorClass(400)).toBe('validation');
  });

  it('maps 402 to budget', () => {
    expect(mapHttpToErrorClass(402)).toBe('budget');
  });

  it('maps 429 insufficient_quota to budget', () => {
    expect(mapHttpToErrorClass(429, 'insufficient_quota')).toBe('budget');
  });

  it('maps 429 without quota code to rate_limit', () => {
    expect(mapHttpToErrorClass(429)).toBe('rate_limit');
  });

  it('maps 409 and 425 to not_ready', () => {
    expect(mapHttpToErrorClass(409)).toBe('not_ready');
    expect(mapHttpToErrorClass(425)).toBe('not_ready');
  });

  it('maps 500, 502, 503 to transient', () => {
    expect(mapHttpToErrorClass(500)).toBe('transient');
    expect(mapHttpToErrorClass(502)).toBe('transient');
    expect(mapHttpToErrorClass(503)).toBe('transient');
  });

  it('maps 504 to timeout', () => {
    expect(mapHttpToErrorClass(504)).toBe('timeout');
  });

  it('maps SAFETY.INPUT.1 to moderation', () => {
    expect(mapHttpToErrorClass(400, 'SAFETY.INPUT.1')).toBe('moderation');
  });

  it('maps other statuses to provider', () => {
    expect(mapHttpToErrorClass(418)).toBe('provider');
    expect(mapHttpToErrorClass(404)).toBe('provider');
  });
});

describe('ProviderError', () => {
  it('carries error_class, message, and optional retryAfterSec', () => {
    const err = new ProviderError('rate_limit', 'slow down', 30);
    expect(err).toBeInstanceOf(Error);
    expect(err.error_class).toBe('rate_limit');
    expect(err.message).toBe('slow down');
    expect(err.retryAfterSec).toBe(30);
  });
});
