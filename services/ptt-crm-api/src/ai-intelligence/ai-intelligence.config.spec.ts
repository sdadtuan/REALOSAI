import { AiIntelligenceConfigService } from './ai-intelligence.config';

describe('AiIntelligenceConfigService', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults copilot off and parses pilot ids', () => {
    delete process.env.PTT_AI_COPILOT_ENABLED;
    process.env.PTT_AI_PILOT_USER_IDS = ' u1 , u2 ';
    const cfg = new AiIntelligenceConfigService();
    expect(cfg.copilotEnabled).toBe(false);
    expect(cfg.pilotUserIds).toEqual(['u1', 'u2']);
    expect(cfg.isPilotUser('u1')).toBe(true);
    expect(cfg.isPilotUser('other')).toBe(false);
  });

  it('allows any staff when pilot list empty', () => {
    delete process.env.PTT_AI_PILOT_USER_IDS;
    const cfg = new AiIntelligenceConfigService();
    expect(cfg.isPilotUser('anyone')).toBe(true);
  });

  it('parses team rollout and team caps', () => {
    process.env.PTT_AI_COPILOT_ENABLED = '1';
    process.env.PTT_AI_COPILOT_ROLLOUT_MODE = 'team';
    process.env.PTT_AI_COPILOT_TEAM_CAPS = 'crm_leads,crm_board';
    const cfg = new AiIntelligenceConfigService();
    expect(cfg.copilotRolloutMode).toBe('team');
    expect(cfg.copilotTeamCaps).toEqual(['crm_leads', 'crm_board']);
    expect(
      cfg.canUseCopilot('staff-1', [{ section: 'crm_leads', action: 'view' }]),
    ).toBe(true);
    expect(cfg.canUseCopilot('staff-1', [{ section: 'crm_agency', action: 'view' }])).toBe(false);
  });

  it('all rollout allows any staff when copilot enabled', () => {
    process.env.PTT_AI_COPILOT_ENABLED = '1';
    process.env.PTT_AI_COPILOT_ROLLOUT_MODE = 'all';
    const cfg = new AiIntelligenceConfigService();
    expect(cfg.canUseCopilot('staff-1', [])).toBe(true);
  });

  it('parses NBA LLM primary flag', () => {
    process.env.PTT_AI_NBA_LLM_PRIMARY = '1';
    expect(new AiIntelligenceConfigService().nbaLlmPrimary).toBe(true);
  });

  it('defaults the AI tools API off and parses its feature flag', () => {
    delete process.env.PTT_AI_TOOLS_API_ENABLED;
    expect(new AiIntelligenceConfigService().toolsApiEnabled).toBe(false);

    process.env.PTT_AI_TOOLS_API_ENABLED = '1';
    expect(new AiIntelligenceConfigService().toolsApiEnabled).toBe(true);
  });
});
