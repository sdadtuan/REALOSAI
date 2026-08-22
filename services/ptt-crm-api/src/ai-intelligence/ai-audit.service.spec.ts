import { ServiceUnavailableException } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';

describe('AiAuditService', () => {
  const runs = {
    tableReady: jest.fn().mockResolvedValue(true),
    insertRun: jest.fn().mockResolvedValue({ id: 'run-abc' }),
  };

  const aiConfig = {
    llmModel: 'gpt-4o-mini',
    logPii: false,
    logPrompts: false,
  };

  let audit: AiAuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    audit = new AiAuditService(runs as never, aiConfig as never);
  });

  it('redacts PII fields by default (BR-AI-05)', () => {
    const redacted = audit.redactPayload({
      text: 'secret note',
      entity_id: 'lead-1',
      mode: 'rules',
    });
    expect(redacted).toMatchObject({
      redacted: true,
      entity_id: 'lead-1',
      mode: 'rules',
    });
    expect(redacted).not.toHaveProperty('text');
  });

  it('stores raw payload when log flags on', () => {
    (aiConfig as { logPii: boolean }).logPii = true;
    const raw = audit.redactPayload({ text: 'visible' });
    expect(raw).toEqual({ text: 'visible' });
    (aiConfig as { logPii: boolean }).logPii = false;
  });

  it('records success with prompt hash and entity metadata', async () => {
    const id = await audit.recordSuccess(
      {
        useCase: AI_USE_CASE.HEALTH_CHECK,
        entityType: 'lead',
        entityId: 'L1',
        input: { ping: true },
        correlationId: 'req-1',
      },
      { status: 'ok' },
      12,
    );

    expect(id).toBe('run-abc');
    expect(runs.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        useCase: AI_USE_CASE.HEALTH_CHECK,
        status: 'succeeded',
        latencyMs: 12,
        modelName: 'gpt-4o-mini',
        correlationId: 'req-1',
        promptHash: expect.any(String),
      }),
    );
  });

  it('wrap audits successful execution', async () => {
    const wrapped = await audit.wrap(
      { useCase: AI_USE_CASE.SUMMARIZE, input: { text: 'hello' } },
      async () => ({
        data: { summary: 'hi' },
        output: { summary_len: 2 },
        tokenUsage: { total_tokens: 10 },
      }),
    );

    expect(wrapped.data.summary).toBe('hi');
    expect(wrapped.runId).toBe('run-abc');
    expect(wrapped.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(runs.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        tokenUsage: { total_tokens: 10 },
      }),
    );
  });

  it('wrap audits failed execution with error_code', async () => {
    await expect(
      audit.wrap({ useCase: AI_USE_CASE.SCORE_LEAD }, async () => {
        throw new Error('provider down');
      }),
    ).rejects.toThrow('provider down');

    expect(runs.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: AI_AUDIT_ERROR.INTERNAL_ERROR,
        errorMessage: 'provider down',
      }),
    );
  });

  it('assertAuditReady throws when table missing', async () => {
    runs.tableReady.mockResolvedValueOnce(false);
    await expect(audit.assertAuditReady()).rejects.toThrow(ServiceUnavailableException);
  });

  it('recordFailure swallows persist errors', async () => {
    runs.insertRun.mockRejectedValueOnce(new Error('db down'));
    const id = await audit.recordFailure(
      { useCase: AI_USE_CASE.SUMMARIZE },
      'timeout',
      8000,
      AI_AUDIT_ERROR.LLM_TIMEOUT,
    );
    expect(id).toBeNull();
  });
});
