import { ServiceUnavailableException } from '@nestjs/common';
import { AiToolsService } from './ai-tools.service';

describe('AiToolsService', () => {
  const config = { toolsApiEnabled: true };
  const tools = [
    {
      name: 'health_check',
      description: 'Health check',
      inputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: [],
    },
  ];
  const registry = {
    list: jest.fn(() => tools),
    callWithMetadata: jest.fn(),
  };
  const keys = {
    create: jest.fn(),
    listKeys: jest.fn(),
    revoke: jest.fn(),
    recordCall: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    registry.list.mockReturnValue(tools);
  });

  it('rejects tool API calls while the feature flag is disabled', async () => {
    const service = new AiToolsService(
      { toolsApiEnabled: false } as never,
      registry as never,
      keys as never,
    );

    await expect(
      service.call({
        toolName: 'health_check',
        input: {},
        actorId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(registry.callWithMetadata).not.toHaveBeenCalled();
  });

  it('calls a scoped tool and records a successful call log row', async () => {
    registry.callWithMetadata.mockResolvedValue({
      data: { status: 'ok' },
      runId: 'run-1',
    });
    keys.recordCall.mockResolvedValue('log-1');
    const service = new AiToolsService(config as never, registry as never, keys as never);
    const apiKey = {
      id: 'key-1',
      client_id: null,
      allowed_tools: ['health_check'],
    };

    const result = await service.call({
      toolName: 'health_check',
      input: {},
      apiKey,
      actorId: 'ai-tool-key:key-1',
      correlationId: 'corr-1',
    });

    expect(result).toEqual({ status: 'ok' });
    expect(registry.callWithMetadata).toHaveBeenCalledWith('health_check', {}, {
      apiKey,
      actorId: 'ai-tool-key:key-1',
      correlationId: 'corr-1',
    });
    expect(keys.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: 'key-1',
        toolName: 'health_check',
        inputJson: {},
        outputJson: { status: 'ok' },
        status: 'succeeded',
        latencyMs: expect.any(Number),
        agentRunId: 'run-1',
      }),
    );
  });

  it('gives an authorized staff caller access to the curated registry', async () => {
    registry.callWithMetadata.mockResolvedValue({
      data: { status: 'ok' },
      runId: 'run-1',
    });
    const service = new AiToolsService(config as never, registry as never, keys as never);

    await service.call({
      toolName: 'health_check',
      input: {},
      actorId: 'staff-1',
    });

    expect(registry.callWithMetadata).toHaveBeenCalledWith(
      'health_check',
      {},
      expect.objectContaining({
        apiKey: {
          id: 'staff',
          client_id: null,
          allowed_tools: ['health_check'],
        },
        actorId: 'staff-1',
      }),
    );
    expect(keys.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: null }),
    );
  });

  it('delegates key lifecycle operations without exposing stored hashes', async () => {
    keys.create.mockResolvedValue({
      id: 'key-1',
      plaintextKey: 'ptt_ai_secret',
      keyPrefix: 'ptt_ai_secre',
    });
    keys.listKeys.mockResolvedValue([
      {
        id: 'key-1',
        name: 'bot',
        key_prefix: 'ptt_ai_secre',
        allowed_tools: ['health_check'],
      },
    ]);
    const service = new AiToolsService(config as never, registry as never, keys as never);

    await expect(
      service.createKey({
        name: 'bot',
        allowedTools: ['health_check'],
        clientId: null,
        createdBy: 'staff-1',
      }),
    ).resolves.toEqual({
      id: 'key-1',
      plaintextKey: 'ptt_ai_secret',
      keyPrefix: 'ptt_ai_secre',
    });
    await expect(service.listKeys()).resolves.toEqual([
      expect.objectContaining({ key_prefix: 'ptt_ai_secre' }),
    ]);
    await service.revokeKey('key-1');
    expect(keys.revoke).toHaveBeenCalledWith('key-1');
  });
});
