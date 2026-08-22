import { AiLeadRouteService } from './ai-lead-route.service';

describe('AiLeadRouteService', () => {
  const audit = {
    newRequestId: jest.fn(() => 'req-1'),
    wrap: jest.fn(async (_meta, fn) => {
      const data = await fn();
      return { ...data, runId: 'run-1' };
    }),
  };
  const aiConfig = { leadRoutingEnabled: true, leadRoutingMlEnabled: true };
  const routeContext = { loadRouteContext: jest.fn() };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    listByEntity: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    findById: jest.fn(),
  };
  const crmLegacy = {
    assignLead: jest.fn(),
    createActivity: jest.fn().mockResolvedValue({ activity: { id: 99 } }),
  };
  const timeline = { recordAiAction: jest.fn().mockResolvedValue(null) };

  let service: AiLeadRouteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiLeadRouteService(
      audit as never,
      aiConfig as never,
      routeContext as never,
      recommendations as never,
      crmLegacy as never,
      timeline as never,
    );
  });

  it('creates route_rep recommendation', async () => {
    routeContext.loadRouteContext.mockResolvedValue({
      leadId: 10,
      clientId: null,
      ownerId: null,
      reProjectId: 3,
      channel: 'zalo',
      source: 'zalo',
      status: 'new',
      productLine: null,
      zone: null,
      scoreBand: 'warm',
      leadScore: 55,
      candidates: [
        {
          staff_id: 7,
          staff_name: 'CS A',
          staff_code: 'CS01',
          role: 'sales',
          open_leads: 0,
        },
      ],
    });
    recommendations.insert.mockResolvedValue({
      id: 'rec-1',
      recommendation_type: 'route_rep',
      recommendation_text: 'Phân lead → CS A',
      action_json: {
        recommended_staff_id: 7,
        recommended_staff_name: 'CS A',
        recommended_staff_code: 'CS01',
        strategy: 'source_match',
        reason: 'test',
      },
      confidence: 0.8,
      status: 'pending',
      agent_run_id: 'run-1',
    });

    const out = await service.suggestRouteRep({ lead_id: 10 });
    expect(out.data.recommended_staff_id).toBe(7);
    expect(recommendations.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recommendationType: 'route_rep' }),
    );
  });

  it('executeRouteAccept assigns lead owner', async () => {
    recommendations.findById.mockResolvedValue({
      id: 'rec-1',
      recommendation_type: 'route_rep',
      entity_type: 'lead',
      entity_id: '10',
      recommendation_text: 'route',
      action_json: {
        recommended_staff_id: 7,
        recommended_staff_name: 'CS A',
        strategy: 'project_pool',
        reason: 'pool',
      },
    });

    const activityId = await service.executeRouteAccept('rec-1', 'GDKD');
    expect(activityId).toBe(99);
    expect(crmLegacy.assignLead).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ to_user_id: 7 }),
      'GDKD',
    );
  });
});
