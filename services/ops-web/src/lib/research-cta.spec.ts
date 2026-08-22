import { describe, expect, it } from 'vitest';
import { researchCtaReady } from './research-cta';

describe('researchCtaReady', () => {
  it('is false while lookup is pending', () => {
    expect(researchCtaReady('pending')).toBe(false);
  });

  it('is false when lookup failed', () => {
    expect(researchCtaReady('error')).toBe(false);
  });

  it('is true when lookup settled with no project', () => {
    expect(researchCtaReady('none')).toBe(true);
  });

  it('is true when lookup settled with a project id', () => {
    expect(researchCtaReady(44)).toBe(true);
  });
});
