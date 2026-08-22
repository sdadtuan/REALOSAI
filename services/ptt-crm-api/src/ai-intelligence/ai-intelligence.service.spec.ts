import { AI_USE_CASE } from './ai-audit.constants';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiIntelligenceService } from './ai-intelligence.service';

describe('AiIntelligenceService', () => {
  const config = { databaseUrl: 'postgresql://test' } as never;
  const aiConfig = {
    copilotEnabled: true,
    pilotUserIds: ['staff-1'],
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    scoreAsync: true,
  } as AiIntelligenceConfigService;

  const runs = {
    tableReady: jest.fn(),
    migrationVersion: jest.fn(),
  };

  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-123'),
    recordSuccess: jest.fn().mockResolvedValue('run-1'),
  };

  let service: AiIntelligenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiIntelligenceService(config, aiConfig, runs as never, audit as never);
  });

  it('returns ok envelope when schema and migration ready', async () => {
    runs.tableReady.mockResolvedValue(true);
    runs.migrationVersion.mockResolvedValue('2026-07-26-revenue-os-ai');

    const res = await service.getHealth('corr-1');

    expect(res.meta.request_id).toBe('corr-1');
    expect(res.data.status).toBe('ok');
    expect(res.data.model).toBe('gpt-4o-mini');
    expect(res.data.schema_ready).toBe(true);
    expect(res.errors).toEqual([]);
    expect(audit.recordSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ useCase: AI_USE_CASE.HEALTH_CHECK, correlationId: 'corr-1' }),
      expect.objectContaining({ status: 'ok' }),
      expect.any(Number),
    );
  });

  it('returns disabled when copilot flag off', async () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = false;
    runs.tableReady.mockResolvedValue(true);
    runs.migrationVersion.mockResolvedValue('2026-07-26-revenue-os-ai');

    const res = await service.getHealth();

    expect(res.data.status).toBe('disabled');
    expect(res.data.copilot_enabled).toBe(false);
  });

  it('returns degraded when migration missing', async () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = true;
    runs.tableReady.mockResolvedValue(true);
    runs.migrationVersion.mockResolvedValue(null);

    const res = await service.getHealth();

    expect(res.data.status).toBe('degraded');
    expect(res.data.schema_ready).toBe(false);
  });

  it('skips audit insert when table not ready', async () => {
    runs.tableReady.mockResolvedValue(false);

    await service.getHealth();

    expect(audit.recordSuccess).not.toHaveBeenCalled();
  });
});
