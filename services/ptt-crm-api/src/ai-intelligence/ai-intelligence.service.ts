import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiHealthData, AiHealthResponse } from './ai-intelligence.types';

const MIGRATION_REVENUE_OS_AI = '2026-07-26-revenue-os-ai';

@Injectable()
export class AiIntelligenceService {
  constructor(
    private readonly config: AppConfigService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly runs: AiAgentRunsRepository,
    private readonly audit: AiAuditService,
  ) {}

  async getHealth(requestId?: string): Promise<AiHealthResponse> {
    const started = Date.now();
    const rid = requestId ?? this.audit.newRequestId();

    const postgres = Boolean(this.config.databaseUrl);
    let schemaReady = false;
    let migrationVersion: string | null = null;

    if (postgres) {
      schemaReady = await this.runs.tableReady();
      if (schemaReady) {
        migrationVersion = await this.runs.migrationVersion();
      }
    }

    let status: AiHealthData['status'] = 'ok';
    if (!this.aiConfig.copilotEnabled) {
      status = 'disabled';
    } else if (!schemaReady || migrationVersion !== MIGRATION_REVENUE_OS_AI) {
      status = 'degraded';
    }

    const data: AiHealthData = {
      status,
      service: 'ai-intelligence',
      copilot_enabled: this.aiConfig.copilotEnabled,
      pilot_cohort_size: this.aiConfig.pilotUserIds.length,
      model: this.aiConfig.llmModel,
      llm_provider: this.aiConfig.llmProvider,
      llm_model: this.aiConfig.llmModel,
      score_async: this.aiConfig.scoreAsync,
      schema_ready: schemaReady && migrationVersion === MIGRATION_REVENUE_OS_AI,
      postgres,
      migration_version: migrationVersion,
    };

    if (schemaReady) {
      await this.audit.recordSuccess(
        {
          useCase: AI_USE_CASE.HEALTH_CHECK,
          agentName: 'ai-intelligence',
          correlationId: rid,
          input: {
            copilot_enabled: this.aiConfig.copilotEnabled,
            schema_ready: data.schema_ready,
          },
        },
        { status: data.status },
        Date.now() - started,
      );
    }

    return {
      data,
      meta: { request_id: rid },
      errors: [],
    };
  }
}
