import { AiToolsController } from './ai-tools.controller';

describe('AiToolsController', () => {
  const service = {
    list: jest.fn(),
    call: jest.fn(),
    createKey: jest.fn(),
    listKeys: jest.fn(),
    revokeKey: jest.fn(),
  };
  let controller: AiToolsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AiToolsController(service as never);
  });

  it('passes API-key scope and correlation context to a tool call', async () => {
    service.call.mockResolvedValue({ status: 'ok' });
    const apiKey = {
      id: 'key-1',
      client_id: null,
      allowed_tools: ['health_check'],
    };

    await expect(
      controller.callTool(
        { tool_name: 'health_check', input: {} },
        { aiToolApiKey: apiKey, headers: {} } as never,
        'request-1',
        'corr-1',
      ),
    ).resolves.toEqual({
      tool_name: 'health_check',
      result: { status: 'ok' },
    });

    expect(service.call).toHaveBeenCalledWith({
      toolName: 'health_check',
      input: {},
      apiKey,
      actorId: 'ai-tool-key:key-1',
      correlationId: 'corr-1',
    });
  });

  it('returns a newly-created plaintext key exactly in the create response', async () => {
    service.createKey.mockResolvedValue({
      id: 'key-1',
      plaintextKey: 'ptt_ai_secret',
      keyPrefix: 'ptt_ai_secre',
    });

    await expect(
      controller.createKey(
        {
          name: 'bot',
          allowed_tools: ['health_check'],
          client_id: null,
        },
        { staffUser: { sub: 'staff-1' }, headers: {} } as never,
      ),
    ).resolves.toEqual({
      id: 'key-1',
      key: 'ptt_ai_secret',
      key_prefix: 'ptt_ai_secre',
    });
  });
});
