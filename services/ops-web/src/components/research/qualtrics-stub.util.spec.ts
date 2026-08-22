import { describe, expect, it } from 'vitest';
import { shouldShowQualtricsButton } from './qualtrics-stub.util';

describe('qualtrics-stub.util', () => {
  it('hides Qualtrics CTA when health.qualtrics_enabled is false', () => {
    expect(shouldShowQualtricsButton(false, true)).toBe(false);
    expect(shouldShowQualtricsButton(false, false)).toBe(false);
  });

  it('shows Qualtrics CTA only when qualtrics is enabled and actor can run', () => {
    expect(shouldShowQualtricsButton(true, true)).toBe(true);
    expect(shouldShowQualtricsButton(true, false)).toBe(false);
  });
});
