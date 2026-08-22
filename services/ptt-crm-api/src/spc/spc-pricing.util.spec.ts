import {
  parseVndRange,
  parsePricingText,
  inferServiceTypeFromAppendix,
} from './spc-pricing.util';

describe('spc-pricing.util', () => {
  it('parseVndRange handles 15tr – 80tr', () => {
    expect(parseVndRange('15tr – 80tr')).toEqual({ min_vnd: 15_000_000, max_vnd: 80_000_000 });
  });

  it('parsePricingText setup_plus_retainer DV02 CB', () => {
    const m = parsePricingText(
      'Setup 6-10tr + 7.000.000-10.000.000đ/tháng',
      'setup_retainer',
    );
    expect(m.type).toBe('setup_plus_retainer');
    expect(m.setup_min_vnd).toBe(6_000_000);
    expect(m.monthly_min_vnd).toBe(7_000_000);
  });

  it('inferServiceTypeFromAppendix', () => {
    expect(inferServiceTypeFromAppendix('Setup+Retainer')).toBe('setup_retainer');
    expect(inferServiceTypeFromAppendix('One-time')).toBe('one_time');
    expect(inferServiceTypeFromAppendix('Retainer')).toBe('retainer');
  });
});
