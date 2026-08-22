import { computeLeadRouteV1 } from './lead-route.engine';

describe('lead-route.engine', () => {
  it('picks staff with lowest open leads in project pool', () => {
    const result = computeLeadRouteV1({
      leadId: 101,
      clientId: null,
      ownerId: null,
      reProjectId: 5,
      channel: 'meta',
      source: 'facebook',
      status: 'new',
      productLine: null,
      zone: null,
      scoreBand: 'hot',
      leadScore: 78,
      candidates: [
        {
          staff_id: 1,
          staff_name: 'An',
          staff_code: 'SP01',
          role: 'sales',
          open_leads: 4,
          sort_order: 1,
        },
        {
          staff_id: 2,
          staff_name: 'Bình',
          staff_code: 'SP02',
          role: 'sales',
          open_leads: 1,
          sort_order: 2,
        },
      ],
    });

    expect(result?.recommendedStaffId).toBe(2);
    expect(result?.strategy).toBe('source_match');
    expect(result?.confidence).toBeGreaterThan(0.7);
  });

  it('returns null when no candidates', () => {
    expect(
      computeLeadRouteV1({
        leadId: 1,
        clientId: null,
        ownerId: null,
        reProjectId: null,
        channel: null,
        source: null,
        status: 'new',
        productLine: null,
        zone: null,
        scoreBand: null,
        leadScore: null,
        candidates: [],
      }),
    ).toBeNull();
  });
});
