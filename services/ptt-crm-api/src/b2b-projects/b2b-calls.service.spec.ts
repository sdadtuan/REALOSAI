import { B2bCallsService } from './b2b-calls.service';

describe('B2bCallsService', () => {
  it('applyWebhookBySessionId marks answered', async () => {
    const repo = {
      insertSession: jest.fn(),
      attachProviderCallId: jest.fn(),
      updateState: jest.fn(),
      findBySessionId: jest.fn(async () => ({
        id: 's2',
        leadId: 2,
        staffId: 11,
        state: 'ringing',
        kind: 'human',
        provider: 'stringee',
        providerCallId: null,
      })),
      markLeadAnswered: jest.fn(),
    };
    const alertsRepo = { markAlertsHandled: jest.fn() };
    const dnc = { isBlocked: jest.fn(async () => false) };
    const svc = new B2bCallsService(repo as never, alertsRepo as never, { b2bCpaas: 'mock', b2bProjectOs: true } as never, dnc as never);
    await svc.applyWebhookBySessionId({ sessionId: 's2', state: 'answered', providerCallId: 'call-1' });
    expect(repo.attachProviderCallId).toHaveBeenCalledWith('s2', 'call-1');
    expect(repo.markLeadAnswered).toHaveBeenCalledWith(2);
  });

  it('answered marks first-touch via repository', async () => {
    const repo = {
      insertSession: jest.fn(async () => ({ id: 's1', leadId: 1, staffId: 10, state: 'queued', kind: 'human', provider: 'mock', providerCallId: null })),
      attachProviderCallId: jest.fn(),
      updateState: jest.fn(),
      findByProviderCallId: jest.fn(async () => ({
        id: 's1',
        leadId: 1,
        staffId: 10,
        state: 'ringing',
        kind: 'human',
        provider: 'mock',
        providerCallId: 'mock-s1',
      })),
      markLeadAnswered: jest.fn(),
    };
    const alertsRepo = { markAlertsHandled: jest.fn() };
    const dnc = { isBlocked: jest.fn(async () => false) };
    const svc = new B2bCallsService(repo as never, alertsRepo as never, { b2bCpaas: 'mock', b2bProjectOs: true } as never, dnc as never);
    await svc.applyWebhook({ providerCallId: 'mock-s1', state: 'answered' });
    expect(repo.updateState).toHaveBeenCalledWith(expect.objectContaining({ state: 'answered' }));
    expect(repo.markLeadAnswered).toHaveBeenCalledWith(1);
  });

  it('cpaas down surfaces tel fallback', async () => {
    const repo = {
      insertSession: jest.fn(async () => ({ id: 's1', leadId: 1, staffId: 10, state: 'queued', kind: 'human', provider: 'down', providerCallId: null })),
      attachProviderCallId: jest.fn(),
    };
    const alertsRepo = { markAlertsHandled: jest.fn() };
    const dnc = { isBlocked: jest.fn(async () => false) };
    const svc = new B2bCallsService(repo as never, alertsRepo as never, { b2bCpaas: 'down', b2bProjectOs: true } as never, dnc as never);
    await expect(
      svc.startHumanCall({ leadId: 1, staffId: 10, phone: '090' }),
    ).rejects.toMatchObject({ code: 'cpaas_down' });
  });

  it('dnc blocks human call', async () => {
    const repo = {
      insertSession: jest.fn(),
    };
    const alertsRepo = { markAlertsHandled: jest.fn() };
    const dnc = { isBlocked: jest.fn(async () => true) };
    const svc = new B2bCallsService(repo as never, alertsRepo as never, { b2bCpaas: 'mock', b2bProjectOs: true } as never, dnc as never);
    await expect(svc.startHumanCall({ leadId: 1, staffId: 10, phone: '0900000000' })).rejects.toMatchObject({
      code: 'dnc_blocked',
    });
  });
});
