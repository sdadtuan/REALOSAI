import { assertNoFakeConfidence } from './confidence-rubric.util';
import { VW_LIMITATION } from './market-research.types';
import { computeVanWestendorp, respondentsFromVwEvidence } from './van-westendorp.util';

const FIXTURE_4 = [
  { too_cheap: 10, cheap: 20, expensive: 40, too_expensive: 50 },
  { too_cheap: 12, cheap: 22, expensive: 42, too_expensive: 55 },
  { too_cheap: 8, cheap: 18, expensive: 38, too_expensive: 48 },
  { too_cheap: 15, cheap: 25, expensive: 45, too_expensive: 60 },
];

describe('computeVanWestendorp', () => {
  it('M3-1a: 4-row fixture → n=4; percents in [0,100]; limitation verbatim; no MOE/95% in bins/points', () => {
    const out = computeVanWestendorp(FIXTURE_4);

    expect(out.n).toBe(4);
    expect(out.statistical_inference).toBe(false);
    expect(out.limitation_note).toBe(VW_LIMITATION);
    expect(out.bins.length).toBeGreaterThan(0);
    for (const bin of out.bins) {
      for (const key of ['too_cheap', 'cheap', 'expensive', 'too_expensive'] as const) {
        expect(bin[key]).toBeGreaterThanOrEqual(0);
        expect(bin[key]).toBeLessThanOrEqual(100);
      }
    }
    const numeric = JSON.stringify({ bins: out.bins, points: out.points });
    expect(numeric).not.toMatch(/MOE/);
    expect(numeric).not.toMatch(/95%/);
  });

  it('M3-1b: 3 respondents → vw_insufficient_n', () => {
    expect(() => computeVanWestendorp(FIXTURE_4.slice(0, 3))).toThrow('vw_insufficient_n');
    try {
      computeVanWestendorp(FIXTURE_4.slice(0, 3));
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('vw_insufficient_n');
    }
  });
});

function vwRow(
  locator: string,
  value_num: number | null,
  value_base: string,
): { locator: string; value_num: number | null; value_base: string } {
  return { locator, value_num, value_base };
}

const COMPLETE_R002 = [
  vwRow('R-R002:too_cheap', 8, 'too_cheap'),
  vwRow('R-R002:cheap', 18, 'cheap'),
  vwRow('R-R002:expensive', 38, 'expensive'),
  vwRow('R-R002:too_expensive', 48, 'too_expensive'),
];

describe('respondentsFromVwEvidence', () => {
  it('drops incomplete groups (missing a VW base)', () => {
    const out = respondentsFromVwEvidence([
      vwRow('R-R001:too_cheap', 10, 'too_cheap'),
      vwRow('R-R001:cheap', 20, 'cheap'),
      ...COMPLETE_R002,
    ]);
    expect(out).toEqual([{ too_cheap: 8, cheap: 18, expensive: 38, too_expensive: 48 }]);
  });

  it('drops unordered groups (too_cheap > cheap)', () => {
    const out = respondentsFromVwEvidence([
      vwRow('R-R001:too_cheap', 25, 'too_cheap'),
      vwRow('R-R001:cheap', 20, 'cheap'),
      vwRow('R-R001:expensive', 40, 'expensive'),
      vwRow('R-R001:too_expensive', 50, 'too_expensive'),
      ...COMPLETE_R002,
    ]);
    expect(out).toEqual([{ too_cheap: 8, cheap: 18, expensive: 38, too_expensive: 48 }]);
  });

  it('drops non-finite values', () => {
    const out = respondentsFromVwEvidence([
      vwRow('R-R001:too_cheap', null, 'too_cheap'),
      vwRow('R-R001:cheap', 20, 'cheap'),
      vwRow('R-R001:expensive', 40, 'expensive'),
      vwRow('R-R001:too_expensive', 50, 'too_expensive'),
      vwRow('R-R003:too_cheap', Number.NaN, 'too_cheap'),
      vwRow('R-R003:cheap', 22, 'cheap'),
      vwRow('R-R003:expensive', 42, 'expensive'),
      vwRow('R-R003:too_expensive', 55, 'too_expensive'),
      vwRow('R-R004:too_cheap', Number.POSITIVE_INFINITY, 'too_cheap'),
      vwRow('R-R004:cheap', 25, 'cheap'),
      vwRow('R-R004:expensive', 45, 'expensive'),
      vwRow('R-R004:too_expensive', 60, 'too_expensive'),
      ...COMPLETE_R002,
    ]);
    expect(out).toEqual([{ too_cheap: 8, cheap: 18, expensive: 38, too_expensive: 48 }]);
  });
});

describe('assertNoFakeConfidence M3-1c', () => {
  it("M3-1c: assertNoFakeConfidence('MOE 3%', false) → forbidden_confidence_wording", () => {
    expect(() => assertNoFakeConfidence('MOE 3%', false)).toThrow('forbidden_confidence_wording');
    try {
      assertNoFakeConfidence('MOE 3%', false);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('forbidden_confidence_wording');
    }
  });
});
