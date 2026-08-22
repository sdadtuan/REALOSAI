import { auditBundlePrice } from './spc-bundle-audit.util';

describe('spc-bundle-audit.util', () => {
  const components = [
    {
      component_code: 'DV01-C01',
      name_vi: 'Logo',
      included: true,
      qty: 1,
      pricing_model: { type: 'one_time', min_vnd: 10_000_000, max_vnd: 12_000_000 },
    },
    {
      component_code: 'DV01-C02',
      name_vi: 'Brand book',
      included: true,
      qty: 1,
      pricing_model: { type: 'one_time', min_vnd: 8_000_000, max_vnd: 10_000_000 },
    },
  ];

  it('reports ok when offer band covers component sum', () => {
    const audit = auditBundlePrice(
      'DV01-TC',
      { type: 'one_time', min_vnd: 18_000_000, max_vnd: 22_000_000 },
      components,
    );
    expect(audit.status).toBe('ok');
    expect(audit.components_min_sum_vnd).toBe(18_000_000);
    expect(audit.items).toHaveLength(2);
  });

  it('warns when offer max is below component floor', () => {
    const audit = auditBundlePrice(
      'DV01-TC',
      { type: 'one_time', min_vnd: 10_000_000, max_vnd: 15_000_000 },
      components,
    );
    expect(audit.status).toBe('warn_below_floor');
    expect(audit.delta_max_vnd).toBeLessThan(0);
  });

  it('reports no_components when bundle empty', () => {
    const audit = auditBundlePrice(
      'DV01-TC',
      { type: 'one_time', min_vnd: 10_000_000, max_vnd: 20_000_000 },
      [],
    );
    expect(audit.status).toBe('no_components');
  });
});
