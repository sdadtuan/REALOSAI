import { computeLeadRouteMlV1 } from './lead-route-ml.engine';
import { LeadRouteContext } from './lead-route.types';

describe('computeLeadRouteMlV1', () => {
  const base: LeadRouteContext = {
    leadId: 1,
    clientId: null,
    ownerId: null,
    reProjectId: null,
    channel: 'meta',
    source: 'facebook',
    status: 'moi',
    productLine: null,
    zone: null,
    scoreBand: 'hot',
    leadScore: 82,
    candidates: [
      { staff_id: 10, staff_name: 'A', staff_code: 'SA', role: 'marketing', open_leads: 2 },
      { staff_id: 11, staff_name: 'B', staff_code: 'SB', role: 'sales', open_leads: 0 },
    ],
  };

  it('prefers marketing rep for meta channel with lower load', () => {
    const out = computeLeadRouteMlV1(base);
    expect(out).not.toBeNull();
    expect(out?.ruleId).toBe('route_ml_v1');
    expect(out?.recommendedStaffId).toBeDefined();
    expect(out?.confidence).toBeGreaterThan(0.6);
  });

  it('returns null when no candidates', () => {
    expect(computeLeadRouteMlV1({ ...base, candidates: [] })).toBeNull();
  });
});
