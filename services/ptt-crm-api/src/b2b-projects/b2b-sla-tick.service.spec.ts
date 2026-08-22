import { B2bSlaTickService } from './b2b-sla-tick.service';

function baseRepo() {
  return {
    getProject: async () => ({
      id: 'p',
      sla_json: {},
      commission_json: { first_touch_pct: 30, closer_pct: 70 },
      business_hours_json: {},
    }),
    resolveSlaConfig: () => ({
      hot: { warnMin: 3, hopMin: 5 },
      warm: { warnMin: 10, hopMin: 15 },
      cold: { warnMin: 25, hopMin: 30 },
      maxHops: 2,
    }),
    resolveBusinessHours: () => ({
      tz: 'Asia/Ho_Chi_Minh',
      days: [1, 2, 3, 4, 5, 6],
      start: '00:00',
      end: '23:59',
    }),
    resolveCommission: () => ({ firstTouchPct: 30, closerPct: 70 }),
    loadAssignPool: async () => [
      { staffId: 10, salesLevel: 'a', openFirstTouch: 1, inCall: false },
      { staffId: 11, salesLevel: 'a', openFirstTouch: 0, inCall: false },
    ],
    applyHop: jest.fn(),
    markGdkdQueue: jest.fn(),
  };
}

describe('B2bSlaTickService', () => {
  it('hops hot lead at 5m', async () => {
    const repo = {
      ...baseRepo(),
      listOpenB2bLeads: async () => [
        {
          leadId: 1,
          ownerId: 10,
          score: 80,
          assignedAt: new Date(Date.now() - 6 * 60_000),
          hopCount: 0,
          hasCallActivity: false,
          answered: false,
          projectId: 'p',
          aiCallEnabled: true,
          channel: 'meta',
          source: 'facebook',
          phone: '0901234567',
        },
      ],
    };
    const calls = {
      startAiCall: jest.fn(),
      hasHumanDial: async () => false,
      hasAiCall: async () => false,
    };
    const tick = new B2bSlaTickService(repo as never, { b2bProjectOs: true } as never, calls as never);
    await tick.tick(new Date());
    expect(repo.applyHop).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 1, toOwnerId: 11, hopKind: 'sla_reassign' }),
    );
  });

  it('skips when flag off', async () => {
    const repo = { listOpenB2bLeads: jest.fn() };
    const calls = { startAiCall: jest.fn(), hasHumanDial: jest.fn(), hasAiCall: jest.fn() };
    const tick = new B2bSlaTickService(repo as never, { b2bProjectOs: false } as never, calls as never);
    const out = await tick.tick(new Date());
    expect(out.processed).toBe(0);
    expect(repo.listOpenB2bLeads).not.toHaveBeenCalled();
  });

  it('B2B-14 starts AI at warn if staff never dialed', async () => {
    const repo = {
      ...baseRepo(),
      listOpenB2bLeads: async () => [
        {
          leadId: 1,
          ownerId: 10,
          score: 80,
          assignedAt: new Date(Date.now() - 3 * 60_000),
          hopCount: 0,
          hasCallActivity: false,
          answered: false,
          projectId: 'p',
          aiCallEnabled: true,
          channel: 'meta',
          source: 'facebook',
          phone: '0901234567',
        },
      ],
    };
    const calls = {
      startAiCall: jest.fn(),
      hasHumanDial: async () => false,
      hasAiCall: async () => false,
    };
    const tick = new B2bSlaTickService(repo as never, { b2bProjectOs: true } as never, calls as never);
    await tick.tick(new Date());
    expect(calls.startAiCall).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 1, phone: '0901234567' }),
    );
    expect(repo.applyHop).not.toHaveBeenCalled();
  });

  it('B2B-13 does not AI-call before warn', async () => {
    const repo = {
      ...baseRepo(),
      listOpenB2bLeads: async () => [
        {
          leadId: 1,
          ownerId: 10,
          score: 80,
          assignedAt: new Date(Date.now() - 60_000),
          hopCount: 0,
          hasCallActivity: false,
          answered: false,
          projectId: 'p',
          aiCallEnabled: true,
          channel: 'meta',
          source: 'facebook',
          phone: '0901234567',
        },
      ],
    };
    const calls = {
      startAiCall: jest.fn(),
      hasHumanDial: async () => false,
      hasAiCall: async () => false,
    };
    const tick = new B2bSlaTickService(repo as never, { b2bProjectOs: true } as never, calls as never);
    await tick.tick(new Date());
    expect(calls.startAiCall).not.toHaveBeenCalled();
  });
});
