import { B2bFirstAssignService } from './b2b-first-assign.service';

describe('B2bFirstAssignService', () => {
  it('uses hybrid_timeout when ml exceeds 800ms', async () => {
    const svc = new B2bFirstAssignService(
      {
        loadAssignPool: async () => [
          { staffId: 2, salesLevel: 'a', openFirstTouch: 0, inCall: false },
        ],
      } as never,
      {
        routeMl: () => new Promise(() => undefined),
      } as never,
      { fanoutArrival: jest.fn() } as never,
      { listProjectStaff: jest.fn() } as never,
      { recordFirstAssign: jest.fn() } as never,
    );
    const r = await svc.assign({ projectId: 'p', score: 80, now: Date.now() });
    expect(r.strategy).toBe('hybrid_timeout');
    expect(r.ownerId).toBe(2);
  });

  it('uses ai_analytics when ml resolves in time', async () => {
    const svc = new B2bFirstAssignService(
      {
        loadAssignPool: async () => [
          { staffId: 2, salesLevel: 'a', openFirstTouch: 0, inCall: false },
        ],
      } as never,
      {
        routeMl: async () => ({ staffId: 2, confidence: 0.9, reason: 'ml pick' }),
      } as never,
      { fanoutArrival: jest.fn() } as never,
      { listProjectStaff: jest.fn() } as never,
      { recordFirstAssign: jest.fn() } as never,
    );
    const r = await svc.assign({ projectId: 'p', score: 80 });
    expect(r.strategy).toBe('ai_analytics');
    expect(r.ownerId).toBe(2);
  });
});
