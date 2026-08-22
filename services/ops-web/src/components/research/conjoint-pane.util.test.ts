import { describe, expect, it } from 'vitest';
import {
  formatSharePct,
  formatWhatIfResult,
  shouldShowConjointTab,
  defaultWhatIfScenario,
  CJ_TAB_BANNER,
  CJ_WHATIF_BANNER,
  CJ_WHATIF_PERSIST_BANNER,
  formatScenarioSummary,
} from './conjoint-pane.util';

describe('conjoint-pane.util', () => {
  it('keeps conjoint tab banner verbatim', () => {
    expect(CJ_TAB_BANNER).toBe(
      'Conjoint lite — đếm mức được chọn theo thuộc tính. Không market simulator. Không suy MOE.',
    );
  });

  it('shows conjoint tab only on PRICE_OFFER', () => {
    expect(shouldShowConjointTab('PRICE_OFFER')).toBe(true);
    expect(shouldShowConjointTab('CAT_REVIEW')).toBe(false);
    expect(shouldShowConjointTab('TRACKER')).toBe(false);
  });

  it('formats share pct', () => {
    expect(formatSharePct(50)).toBe('50');
    expect(formatSharePct(37.5)).toBe('37.5');
  });

  it('P34 formats what-if result and defaults scenario from recommendation', () => {
    expect(CJ_WHATIF_BANNER).toMatch(/What-if lite/);
    expect(formatWhatIfResult(2, 8, 25)).toBe('Khớp mẫu: 2 / 8 (25%)');
    expect(
      defaultWhatIfScenario(
        [
          { name: 'price', levels: [{ label: '89k' }, { label: '99k' }], top_level: '99k' },
          { name: 'pack_size', levels: [{ label: '500ml' }], top_level: '500ml' },
        ],
        { levels: [{ attribute: 'price', level: '89k' }] },
      ),
    ).toEqual({ price: '89k', pack_size: '500ml' });
  });

  it('P38 persist banner and scenario summary', () => {
    expect(CJ_WHATIF_PERSIST_BANNER).toMatch(/không tạo insight/);
    expect(formatScenarioSummary({ price: '99k', pack_size: '500ml' })).toBe(
      'price: 99k · pack_size: 500ml',
    );
  });
});
