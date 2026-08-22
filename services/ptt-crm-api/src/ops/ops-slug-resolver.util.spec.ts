import * as path from 'path';
import { loadOpsRouteMap } from './ops-route-map.loader';
import { buildSlugIndex, resolveDvByLifecycleSlug } from './ops-slug-resolver.util';

const routeMapPath = path.join(
  __dirname,
  '../../../../docs/specs/ops-dv01-dv21-route-map.json',
);

describe('ops-slug-resolver', () => {
  const routeMap = loadOpsRouteMap(routeMapPath);

  it('resolves primary slug tiep-thi-noi-dung → DV02', () => {
    const dv = resolveDvByLifecycleSlug('tiep-thi-noi-dung', routeMap);
    expect(dv?.code).toBe('DV02');
  });

  it('resolves dich-vu-seo-tong-the → DV05', () => {
    const dv = resolveDvByLifecycleSlug('dich-vu-seo-tong-the', routeMap);
    expect(dv?.code).toBe('DV05');
  });

  it('resolves legacy seo-retainer → DV05', () => {
    const dv = resolveDvByLifecycleSlug('seo-retainer', routeMap);
    expect(dv?.code).toBe('DV05');
  });

  it('resolves quang-cao-facebook', () => {
    const dv = resolveDvByLifecycleSlug('quang-cao-facebook', routeMap);
    expect(dv?.code).toBeTruthy();
  });

  it('returns null for unknown slug', () => {
    expect(resolveDvByLifecycleSlug('unknown-slug', routeMap)).toBeNull();
  });

  it('index has 21 dv codes', () => {
    const codes = new Set(routeMap.services.map((s) => s.code));
    expect(codes.size).toBe(21);
  });

  it('buildSlugIndex maps alternates', () => {
    const idx = buildSlugIndex(routeMap);
    expect(idx.get('dich-vu-seo-local')).toBe('DV05');
  });
});
