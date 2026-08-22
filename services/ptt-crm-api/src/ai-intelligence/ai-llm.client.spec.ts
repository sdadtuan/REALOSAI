import { AiLlmClient } from './ai-llm.client';
import { AiIntelligenceConfigService } from './ai-intelligence.config';

describe('AiLlmClient', () => {
  it('uses stub mode when API key missing', async () => {
    const config = {
      llmApiKey: null,
      llmModel: 'gpt-4o-mini',
      llmTimeoutMs: 5000,
    } as AiIntelligenceConfigService;
    const client = new AiLlmClient(config);
    const result = await client.summarizeStructured({
      context: 'activity',
      systemPrompt: 'test',
      userContent: 'TEXT:\n' + 'Khách hàng quan tâm gói quảng cáo Meta Ads cho spa. '.repeat(3),
    });
    expect(result.stubMode).toBe(true);
    expect(result.parsed.summary.length).toBeGreaterThan(5);
    expect(result.parsed.extracted.risk_flags).toContain('stub_mode');
  });
});
