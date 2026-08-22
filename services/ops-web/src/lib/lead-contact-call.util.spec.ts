import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { phoneTelHref, shouldTelFallbackOnCallError } from './lead-contact-call.util';

describe('lead-contact-call.util', () => {
  it('builds tel href from phone', () => {
    expect(phoneTelHref('0901 234 567')).toBe('tel:0901234567');
  });

  it('503 triggers tel fallback', () => {
    expect(shouldTelFallbackOnCallError(new ApiError('cpaas_down', 503))).toBe(true);
    expect(shouldTelFallbackOnCallError(new ApiError('bad', 400))).toBe(false);
  });
});
