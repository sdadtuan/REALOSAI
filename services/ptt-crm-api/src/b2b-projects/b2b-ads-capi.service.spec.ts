import { B2bAdsCapiService } from './b2b-ads-capi.service';

describe('B2bAdsCapiService', () => {
  it('does not call HTTP when flag off', async () => {
    const dispatch = jest.fn();
    const repo = {
      tableReady: jest.fn(async () => true),
      loadLeadConversionContext: jest.fn(async () => ({
        phone: '0901234567',
        channel: 'meta',
        campaignId: 'C1',
      })),
      insertLog: jest.fn(),
    };
    const svc = new B2bAdsCapiService(repo as never, {
      b2bProjectOs: true,
      b2bAdsCapi: false,
    } as never);
    svc.setDispatchFn(dispatch);
    const ok = await svc.recordStatusOutcome({ leadId: 1, status: 'won' });
    expect(ok).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(repo.insertLog).not.toHaveBeenCalled();
  });

  it('when flag on, dispatch body has hashed_phone', async () => {
    const dispatch = jest.fn(async (body) => {
      expect(body.hashedPhone).toMatch(/^[a-f0-9]{64}$/);
      return { ok: true };
    });
    const repo = {
      tableReady: jest.fn(async () => true),
      loadLeadConversionContext: jest.fn(async () => ({
        phone: '0901234567',
        channel: 'meta',
        campaignId: 'C1',
      })),
      insertLog: jest.fn(),
    };
    const svc = new B2bAdsCapiService(repo as never, {
      b2bProjectOs: true,
      b2bAdsCapi: true,
    } as never);
    svc.setDispatchFn(dispatch);
    const ok = await svc.recordStatusOutcome({ leadId: 2, status: 'chot' });
    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalled();
    expect(repo.insertLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', hashedPhone: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    );
  });
});
