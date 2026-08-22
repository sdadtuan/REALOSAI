import { BadRequestException } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from '../ai-audit.constants';
import { AgentRegistry } from './agent.registry';

describe('AgentRegistry', () => {
  const leadScore = { scoreLead: jest.fn() };
  const leadRoute = { suggestRouteRep: jest.fn() };
  const renewal = { scanRenewalWindows: jest.fn() };
  const upsell = { suggestUpsell: jest.fn() };
  const anomaly = { getDigest: jest.fn() };

  let registry: AgentRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AgentRegistry(
      leadScore as never,
      leadRoute as never,
      renewal as never,
      upsell as never,
      anomaly as never,
    );
  });

  it('throws VALIDATION_ERROR for an unknown step', () => {
    expect.assertions(3);

    try {
      registry.get('unknown_step');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          error: 'unknown_orchestrator_step',
          error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
        }),
      );
      expect((error as BadRequestException).message).toContain('unknown_step');
    }
  });

  it('registers canonical metadata and delegates score_lead', async () => {
    const response = { data: { score: 72 }, meta: { request_id: 'req-1' }, errors: [] };
    leadScore.scoreLead.mockResolvedValue(response);

    const agent = registry.get('score_lead');
    const result = await agent.handler(
      { entityType: 'lead', entityId: '42', leadId: 42 },
      { actorId: 'staff-1', correlationId: 'corr-1', clientId: 'client-1' },
    );

    expect(agent).toEqual(
      expect.objectContaining({
        agentName: 'lead-qualification',
        useCase: AI_USE_CASE.SCORE_LEAD,
      }),
    );
    expect(leadScore.scoreLead).toHaveBeenCalledWith({
      leadId: 42,
      actorId: 'staff-1',
      correlationId: 'corr-1',
      clientId: 'client-1',
    });
    expect(result).toBe(response);
  });

  it('delegates the remaining registered steps', async () => {
    leadRoute.suggestRouteRep.mockResolvedValue({ data: { route: true } });
    renewal.scanRenewalWindows.mockResolvedValue({ data: { scanned: 1 } });
    upsell.suggestUpsell.mockResolvedValue({ data: { created: 1 } });
    anomaly.getDigest.mockResolvedValue({ data: { digest: 'ok' } });

    const auditCtx = { actorId: 'staff-1', correlationId: 'corr-1', clientId: 'client-1' };

    await registry.get('route_rep').handler({ leadId: 42 }, auditCtx);
    await registry.get('renewal_scan').handler({}, auditCtx);
    await registry.get('upsell_suggest').handler({}, auditCtx);
    await registry.get('channel_anomaly').handler({}, auditCtx);

    expect(leadRoute.suggestRouteRep).toHaveBeenCalledWith({
      lead_id: 42,
      actorId: 'staff-1',
      correlationId: 'corr-1',
    });
    expect(renewal.scanRenewalWindows).toHaveBeenCalledWith({
      actorId: 'staff-1',
      correlationId: 'corr-1',
    });
    expect(upsell.suggestUpsell).toHaveBeenCalledWith({
      client_id: 'client-1',
      actorId: 'staff-1',
      correlationId: 'corr-1',
    });
    expect(anomaly.getDigest).toHaveBeenCalledWith({
      client_id: 'client-1',
      actorId: 'staff-1',
      correlationId: 'corr-1',
    });
  });
});
