import { Injectable } from '@nestjs/common';

function envFlag(name: string, defaultValue = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

export type CopilotRolloutMode = 'pilot' | 'team' | 'all';

export interface StaffCapRef {
  section: string;
  action: string;
}

@Injectable()
export class AiIntelligenceConfigService {
  readonly copilotEnabled: boolean;
  readonly copilotRolloutMode: CopilotRolloutMode;
  readonly copilotTeamCaps: string[];
  readonly nbaLlmPrimary: boolean;
  readonly scoreV2Enabled: boolean;
  readonly pilotUserIds: string[];
  readonly llmProvider: string;
  readonly llmModel: string;
  readonly llmTimeoutMs: number;
  readonly logPii: boolean;
  readonly logPrompts: boolean;
  readonly scoreAsync: boolean;
  readonly llmApiKey: string | null;
  readonly summarizeRateLimitPerMin: number;
  readonly summarizeMinTextLength: number;
  readonly leadRoutingEnabled: boolean;
  readonly leadRoutingMlEnabled: boolean;
  readonly upsellEnabled: boolean;
  readonly orchestratorEnabled: boolean;
  readonly orchestratorCronEnabled: boolean;
  readonly toolsApiEnabled: boolean;

  constructor() {
    this.copilotEnabled = envFlag('PTT_AI_COPILOT_ENABLED', false);
    const rolloutRaw = (process.env.PTT_AI_COPILOT_ROLLOUT_MODE ?? 'pilot').trim().toLowerCase();
    this.copilotRolloutMode =
      rolloutRaw === 'team' || rolloutRaw === 'all' ? rolloutRaw : 'pilot';
    this.copilotTeamCaps = (process.env.PTT_AI_COPILOT_TEAM_CAPS ?? 'crm_leads')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.nbaLlmPrimary = envFlag('PTT_AI_NBA_LLM_PRIMARY', false);
    this.scoreV2Enabled = envFlag('PTT_AI_SCORE_V2', false);
    this.pilotUserIds = (process.env.PTT_AI_PILOT_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.llmProvider = (process.env.PTT_AI_LLM_PROVIDER ?? 'openai').trim();
    this.llmModel = (process.env.PTT_AI_LLM_MODEL ?? 'gpt-4o-mini').trim();
    this.llmTimeoutMs = Math.max(
      1000,
      Number(process.env.PTT_AI_LLM_TIMEOUT_MS ?? 8000) || 8000,
    );
    this.logPii = envFlag('PTT_AI_LOG_PII', false);
    this.logPrompts = envFlag('PTT_AI_LOG_PROMPTS', false);
    this.scoreAsync = envFlag('PTT_AI_SCORE_ASYNC', true);
    this.llmApiKey =
      (process.env.AI_LLM_API_KEY ?? process.env.PTT_AI_LLM_API_KEY ?? '').trim() || null;
    this.summarizeRateLimitPerMin = Math.max(
      1,
      Number(process.env.PTT_AI_SUMMARIZE_RATE_LIMIT_PER_MIN ?? 20) || 20,
    );
    this.summarizeMinTextLength = Math.max(
      10,
      Number(process.env.PTT_AI_SUMMARIZE_MIN_TEXT ?? 50) || 50,
    );
    this.leadRoutingEnabled = envFlag('PTT_AI_LEAD_ROUTING_ENABLED', true);
    this.leadRoutingMlEnabled = envFlag('PTT_AI_LEAD_ROUTING_ML_ENABLED', true);
    this.upsellEnabled = envFlag('PTT_AI_UPSELL_ENABLED', true);
    this.orchestratorEnabled = envFlag('PTT_AI_ORCHESTRATOR_ENABLED', false);
    this.orchestratorCronEnabled = envFlag('PTT_AI_ORCHESTRATOR_CRON_ENABLED', false);
    this.toolsApiEnabled = envFlag('PTT_AI_TOOLS_API_ENABLED', false);
  }

  isPilotUser(staffId: string | undefined | null): boolean {
    if (!staffId) return false;
    if (this.pilotUserIds.length === 0) return true;
    return this.pilotUserIds.includes(staffId);
  }

  hasTeamCopilotCap(caps: StaffCapRef[] | undefined | null): boolean {
    if (!caps?.length || !this.copilotTeamCaps.length) return false;
    return this.copilotTeamCaps.some((section) =>
      caps.some(
        (cap) =>
          cap.section === section && (cap.action === 'view' || cap.action === 'edit'),
      ),
    );
  }

  canUseCopilot(staffId: string | undefined | null, caps?: StaffCapRef[] | null): boolean {
    if (!this.copilotEnabled) return false;
    if (this.copilotRolloutMode === 'all') return Boolean(staffId);
    if (this.copilotRolloutMode === 'team') return this.hasTeamCopilotCap(caps);
    return this.isPilotUser(staffId);
  }
}
