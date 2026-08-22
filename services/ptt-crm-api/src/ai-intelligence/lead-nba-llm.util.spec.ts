import {
  buildNbaLlmStub,
  parseNbaLlmOutput,
  shouldUseNbaLlmFallback,
  NBA_LLM_CONFIDENCE_THRESHOLD,
} from './lead-nba-llm.util';

describe('lead-nba-llm.util', () => {
  it('parseNbaLlmOutput validates action and reason', () => {
    const out = parseNbaLlmOutput({
      action: 'log_call',
      reason: 'Lead mới chưa gọi — ưu tiên log call trong 15p',
      confidence: 0.81,
    });
    expect(out?.action).toBe('log_call');
    expect(out?.confidence).toBe(0.81);
  });

  it('shouldUseNbaLlmFallback when rules silent or low confidence', () => {
    expect(shouldUseNbaLlmFallback({ rulesEmitted: false, rulesConfidence: 0, force: false })).toBe(
      true,
    );
    expect(
      shouldUseNbaLlmFallback({
        rulesEmitted: true,
        rulesConfidence: NBA_LLM_CONFIDENCE_THRESHOLD - 0.01,
        force: false,
      }),
    ).toBe(true);
    expect(
      shouldUseNbaLlmFallback({
        rulesEmitted: true,
        rulesConfidence: 0.9,
        force: false,
      }),
    ).toBe(false);
  });

  it('buildNbaLlmStub returns stub suggestion', () => {
    const stub = buildNbaLlmStub({ channel: 'meta', status: 'moi' });
    expect(stub.source).toBe('llm_stub');
    expect(stub.action).toBe('call_back');
  });
});
