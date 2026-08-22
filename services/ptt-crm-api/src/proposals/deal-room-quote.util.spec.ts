import type { OpsRouteMap } from '../ops/ops.types';
import {
  buildAutoQuoteLineInputs,
  buildDealRoomTierSummaries,
  resolveServiceDvMapping,
  type DealRoomServiceDvMapFile,
} from './deal-room-quote.util';

const routeMap = {
  schema_version: 1,
  services: [
    {
      code: 'DV04',
      name_vi: 'Quảng cáo Meta',
      readiness: 'ready',
      service_slugs: { primary: 'meta-lead-gen', alternates: [] },
      depends_on_dv: [],
    },
    {
      code: 'DV02',
      name_vi: 'Content',
      readiness: 'ready',
      service_slugs: { primary: 'tiep-thi-noi-dung', alternates: [] },
      depends_on_dv: [],
    },
  ],
} as unknown as OpsRouteMap;

const dvMap: DealRoomServiceDvMapFile = {
  schema_version: 1,
  mappings: [
    { service_slug: 'meta-lead-gen', primary_dv: 'DV04', bundle_dv: ['DV02', 'DV20'] },
  ],
};

describe('deal-room-quote.util', () => {
  it('resolves explicit mapping for meta-lead-gen', () => {
    const mapping = resolveServiceDvMapping('meta-lead-gen', routeMap, dvMap);
    expect(mapping.primary_dv).toBe('DV04');
    expect(mapping.bundle_dv).toEqual(['DV02', 'DV20']);
  });

  it('builds auto line from tier pricing', () => {
    const mapping = resolveServiceDvMapping('meta-lead-gen', routeMap, dvMap);
    const lines = buildAutoQuoteLineInputs(
      mapping,
      { standard: { price_vnd: 22000000, min_vnd: 18000000, max_vnd: 26000000 } },
      'standard',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].dv_code).toBe('DV04');
    expect(lines[0].final_price_vnd).toBe(22000000);
  });

  it('builds tier summaries with reference prices', () => {
    const mapping = resolveServiceDvMapping('meta-lead-gen', routeMap, dvMap);
    const tiers = buildDealRoomTierSummaries(
      mapping,
      { standard: { price_vnd: 20000000, min_vnd: 16000000, max_vnd: 25000000 } },
      [],
    );
    expect(tiers).toHaveLength(3);
    const standard = tiers.find((t) => t.tier === 'standard');
    expect(standard?.reference_min_vnd).toBe(16000000);
    expect(standard?.is_reference).toBe(true);
  });
});
