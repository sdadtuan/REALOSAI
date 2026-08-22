import { GtmProposalService } from './gtm-proposal.service';

describe('GtmProposalService', () => {
  it('builds valid PDF for demo request without RNOSAI branding', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue({
        id: '1',
        full_name: 'An',
        company: 'An Agency',
        industry: 'agency',
        sku_interest: 'agy',
        email: 'an@agency.vn',
      }),
    };
    const svc = new GtmProposalService(repo as never);
    const buffer = await svc.buildProposalPdf('1');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(200);
    expect(buffer.toString('latin1')).not.toMatch(/RNOSAI/);
    expect(repo.getById).toHaveBeenCalledWith('1');
  });
});
