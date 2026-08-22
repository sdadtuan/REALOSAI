import { describe, expect, it } from 'vitest';
import { PORTAL_CJ_BANNER, formatSharePct } from './portal-conjoint.util';

describe('portal conjoint lite', () => {
  it('P35 formatSharePct matches staff integer/one-decimal', () => {
    expect(formatSharePct(25)).toBe('25');
    expect(formatSharePct(12.5)).toBe('12.5');
  });

  it('P35 banner forbids MOE claim and market-share census wording', () => {
    expect(PORTAL_CJ_BANNER).toMatch(/convenience/i);
    expect(PORTAL_CJ_BANNER).not.toMatch(/\bMOE\b|95\s*%\s*confidence/i);
    expect(PORTAL_CJ_BANNER).not.toMatch(/census/i);
  });
});
