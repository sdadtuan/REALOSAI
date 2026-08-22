import { computeUpsellSuggestions } from './upsell.engine';
import { UpsellContext } from './upsell.types';

describe('upsell.engine', () => {
  const baseCtx: UpsellContext = {
    clientId: 'client-1',
    clientName: 'Demo Client',
    healthScore: 78,
    healthBand: 'healthy',
    activeServices: [
      {
        lifecycle_id: 101,
        service_slug: 'quang-cao-facebook',
        service_label: 'Facebook Ads',
        contract_title: 'HĐ Meta Q3',
        stage: 'deliver',
      },
    ],
    channels: ['meta'],
    ownedServiceSlugs: ['quang-cao-facebook'],
  };

  it('suggests cross-sell targets not already owned', () => {
    const out = computeUpsellSuggestions(baseCtx, 3);
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((row) => row.target_service_slug === 'quang-cao-google')).toBe(true);
    expect(out.every((row) => !baseCtx.ownedServiceSlugs.includes(row.target_service_slug))).toBe(true);
  });

  it('returns empty when health score below threshold', () => {
    expect(
      computeUpsellSuggestions({ ...baseCtx, healthScore: 40, healthBand: 'critical' }, 3),
    ).toEqual([]);
  });

  it('boosts google ads when meta channel exists without google', () => {
    const out = computeUpsellSuggestions(baseCtx, 3);
    const google = out.find((row) => row.target_service_slug === 'quang-cao-google');
    expect(google?.confidence).toBeGreaterThan(0.75);
  });
});
