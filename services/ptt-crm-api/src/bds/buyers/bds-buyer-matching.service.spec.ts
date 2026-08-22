import { BdsBuyerMatchingService } from './bds-buyer-matching.service';

describe('BdsBuyerMatchingService', () => {
  it('returns available units scored by need', async () => {
    const leadRepo = {
      getLeadForScope: jest.fn().mockResolvedValue({
        id: 1,
        re_project_id: 12,
        tenant_id: 't1',
        meta_json: { need_json: { pn: 2, huong: 'dong' } },
      }),
    };
    const products = {
      listByProject: jest.fn().mockResolvedValue([
        {
          id: 1,
          unit_code: 'A-01-05',
          bedrooms: 2,
          direction: 'dong',
          zone: 'a',
          status: 'available',
          list_price_vnd: 2000000000,
        },
        {
          id: 2,
          unit_code: 'B-02-01',
          bedrooms: 3,
          direction: 'nam',
          zone: 'b',
          status: 'sold',
          list_price_vnd: 3000000000,
        },
      ]),
    };
    const agencyRepo = { listOpenUnits: jest.fn() };
    const svc = new BdsBuyerMatchingService(
      leadRepo as never,
      products as never,
      agencyRepo as never,
    );
    const out = await svc.match(1, 't1');
    expect(out[0].product_id).toBe(1);
    expect(out).toHaveLength(1);
  });
});
