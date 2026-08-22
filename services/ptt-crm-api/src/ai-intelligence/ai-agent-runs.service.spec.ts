import { NotFoundException } from '@nestjs/common';
import { AiAgentRunsService } from './ai-agent-runs.service';

describe('AiAgentRunsService', () => {
  const runs = {
    listRuns: jest.fn(),
    getById: jest.fn(),
  };

  const audit = {
    assertAuditReady: jest.fn().mockResolvedValue(undefined),
    newRequestId: jest.fn().mockReturnValue('req-list'),
    shouldStoreRawPayload: jest.fn().mockReturnValue(false),
    redactPayload: jest.fn((v: Record<string, unknown>) => ({ redacted: true, keys: Object.keys(v) })),
  };

  let service: AiAgentRunsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiAgentRunsService(runs as never, audit as never);
  });

  it('lists runs with redacted payloads', async () => {
    runs.listRuns.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: 'run-1',
          client_id: null,
          agent_name: 'ai-intelligence',
          use_case: 'summarize',
          model_name: 'gpt-4o-mini',
          prompt_hash: 'abc',
          input_json: { text: 'secret' },
          output_json: { summary: 'x' },
          status: 'succeeded',
          latency_ms: 100,
          token_usage: {},
          error_message: null,
          correlation_id: 'req-1',
          actor_id: 'staff-1',
          started_at: '2026-07-26T00:00:00Z',
          ended_at: '2026-07-26T00:00:01Z',
          created_at: '2026-07-26T00:00:00Z',
        },
      ],
    });

    const res = await service.list({ limit: 10 });

    expect(res.data.total).toBe(1);
    expect(res.data.rows[0].prompt_visible).toBe(false);
    expect(res.data.rows[0].input_json).toEqual({ redacted: true, keys: ['text'] });
    expect(audit.assertAuditReady).toHaveBeenCalled();
  });

  it('throws when run not found', async () => {
    runs.getById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
  });
});
