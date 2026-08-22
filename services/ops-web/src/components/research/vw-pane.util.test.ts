import { describe, expect, it } from 'vitest';
import { formatVwPoint, shouldShowVwTab, VW_TAB_BANNER } from './vw-pane.util';

describe('vw-pane.util', () => {
  it('keeps Giá VW banner verbatim', () => {
    expect(VW_TAB_BANNER).toBe(
      'Bảng ước lượng giá — mẫu convenience. Không MOE / 95% confidence.',
    );
  });

  it('shows Giá VW tab only for PRICE_OFFER', () => {
    expect(shouldShowVwTab('PRICE_OFFER')).toBe(true);
    expect(shouldShowVwTab('CAT_REVIEW')).toBe(false);
    expect(shouldShowVwTab('TRACKER')).toBe(false);
    expect(shouldShowVwTab('CONSUMER')).toBe(false);
    expect(shouldShowVwTab('COMP_LAND')).toBe(false);
    expect(shouldShowVwTab('')).toBe(false);
  });

  it('formats VW points as em dash when null', () => {
    expect(formatVwPoint(null)).toBe('—');
    expect(formatVwPoint(15000)).toBe('15000');
    expect(formatVwPoint(0)).toBe('0');
  });
});
