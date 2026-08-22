import { UpsellAgentService } from './upsell-agent.service';

describe('UpsellAgentService', () => {
  const audit = {
    newRequestId: jest.fn(() => 'req-upsell'),
    wrap: jest.fn(async (_meta, fn) => {
      const data = await fn();
      return { ...data, runId: 'run-upsell-1' };
    }),
  };
  const aiConfig = { upsellEnabled: true };
  const contextRepo = {
    loadContext: jest.fn(),
    listActiveClientIds: jest.fn().mockReturnValue([]),
  };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    listByEntity: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
  };
  const lifecycleTasks = {
    createCustomTask: jest.fn().mockReturnValue({ id: 501 }),
  };

  let service: UpsellAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UpsellAgentService(
      audit as never,
      aiConfig as never,
      contextRepo as never,
      recommendations as never,
      lifecycleTasks as never,
    );
  });

  it('creates upsell recommendations for healthy client', async () => {
    contextRepo.loadContext.mockResolvedValue({
      clientId: 'client-1',
      clientName: 'Demo',
      healthScore: 80,
      healthBand: 'healthy',
      activeServices: [
        {
          lifecycle_id: 10,
          service_slug: 'quang-cao-facebook',
          service_label: 'Facebook Ads',
          contract_title: 'HĐ Meta',
          stage: 'deliver',
        },
      ],
      channels: ['meta'],
      ownedServiceSlugs: ['quang-cao-facebook'],
    });
    recommendations.insert.mockImplementation(async (args) => ({
      id: 'rec-upsell-1',
      entity_id: args.entityId,
      recommendation_type: 'upsell',
      recommendation_text: args.text,
      action_json: args.actionJson,
      confidence: args.confidence,
      status: 'pending',
    }));

    const out = await service.suggestUpsell({ client_id: 'client-1', limit: 2 });
    expect(out.data.created).toBeGreaterThan(0);
    expect(recommendations.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recommendationType: 'upsell' }),
    );
  });

  it('approve creates retain lifecycle task', async () => {
    recommendations.findById.mockResolvedValue({
      id: 'rec-upsell-1',
      recommendation_type: 'upsell',
      entity_id: 'client-1',
      client_id: 'client-1',
      status: 'pending',
      recommendation_text: 'Upsell draft',
      action_json: {
        lifecycle_id: 10,
        target_service_label: 'Google Ads',
        draft_text: 'Draft upsell text long enough',
      },
    });

    const out = await service.approveUpsell('rec-upsell-1', 'Draft upsell text long enough', 'am-1', 'am@demo.local');
    expect(out.data.status).toBe('accepted');
    expect(out.data.follow_up_task_id).toBe(501);
    expect(lifecycleTasks.createCustomTask).toHaveBeenCalledWith(
      10,
      'retain',
      expect.stringContaining('Upsell'),
      expect.any(String),
    );
  });
});
