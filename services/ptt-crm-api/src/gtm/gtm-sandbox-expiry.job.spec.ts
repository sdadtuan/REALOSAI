import { GtmSandboxExpiryJob } from './gtm-sandbox-expiry.job';
import { GtmSandboxService } from './gtm-sandbox.service';

describe('GtmSandboxExpiryJob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-30T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('disables expired sandbox users via sandbox service', async () => {
    const sandbox = {
      expireSandboxes: jest.fn().mockResolvedValue(2),
    };
    const job = new GtmSandboxExpiryJob(sandbox as unknown as GtmSandboxService);
    await job.handleExpiry();
    expect(sandbox.expireSandboxes).toHaveBeenCalledWith(new Date('2026-08-30T10:00:00.000Z'));
  });
});
