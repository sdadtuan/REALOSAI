import { BadRequestException } from '@nestjs/common';
import { AutomationWorkflowsService } from './automation-workflows.service';

describe('AutomationWorkflowsService simulate', () => {
  const repo = {
    tableReady: jest.fn().mockResolvedValue(true),
    findById: jest.fn(),
    listNodes: jest.fn(),
  };
  const leadContext = {
    loadLeadScoreContext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findById.mockResolvedValue({
      id: 'wf-1',
      name: 'Test',
      trigger_type: 'event',
      status: 'draft',
      version: 1,
      definition_json: { trigger_event: 'lead.created' },
      client_id: null,
      created_by: null,
      created_at: '',
      updated_at: '',
    });
    repo.listNodes.mockResolvedValue([
      { node_key: 'trigger_1', node_type: 'trigger', config_json: { event: 'lead.created' }, sort_order: 0 },
      { node_key: 'score_1', node_type: 'ai_score', config_json: {}, sort_order: 1 },
    ]);
    leadContext.loadLeadScoreContext.mockResolvedValue({
      leadId: 42,
      channel: 'meta',
      campaignId: 'camp-1',
      source: 'meta',
      createdAt: new Date(),
      receivedAt: new Date(),
      firstContactAt: null,
      status: 'new',
      clientId: null,
      externalLeadId: null,
      isDuplicate: false,
      timelineEventCount: 0,
      meta: {},
      estimatedDealValueVnd: null,
    });
  });

  it('simulate returns dry_run without persisting', async () => {
    const service = new AutomationWorkflowsService(repo as never, leadContext as never);
    const out = await service.simulate('wf-1', { lead_id: 42 });
    expect(out.data.dry_run).toBe(true);
    expect(out.data.steps.some((s) => s.node_type === 'ai_score' && s.status === 'ok')).toBe(true);
    expect(repo.findById).toHaveBeenCalled();
  });

  it('rejects simulate without lead id', async () => {
    const service = new AutomationWorkflowsService(repo as never, leadContext as never);
    await expect(service.simulate('wf-1', {})).rejects.toThrow(BadRequestException);
  });
});
