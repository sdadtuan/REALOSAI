import { Injectable, NotFoundException } from '@nestjs/common';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAuditService } from './ai-audit.service';
import {
  AiAgentRunListQuery,
  AiAgentRunRecord,
  AiApiEnvelope,
} from './ai-intelligence.types';

export type AiAgentRunPublicRecord = Omit<AiAgentRunRecord, 'input_json' | 'output_json'> & {
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  prompt_visible: boolean;
};

export type AiAgentRunListResponse = AiApiEnvelope<{
  rows: AiAgentRunPublicRecord[];
  total: number;
  limit: number;
  offset: number;
}>;

export type AiAgentRunDetailResponse = AiApiEnvelope<AiAgentRunPublicRecord>;

@Injectable()
export class AiAgentRunsService {
  constructor(
    private readonly runs: AiAgentRunsRepository,
    private readonly audit: AiAuditService,
  ) {}

  async list(
    query: AiAgentRunListQuery,
    requestId?: string,
  ): Promise<AiAgentRunListResponse> {
    await this.audit.assertAuditReady();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const result = await this.runs.listRuns({ ...query, limit, offset });

    return {
      data: {
        rows: result.rows.map((row) => this.toPublicRecord(row)),
        total: result.total,
        limit,
        offset,
      },
      meta: { request_id: requestId ?? this.audit.newRequestId() },
      errors: [],
    };
  }

  async getById(id: string, requestId?: string): Promise<AiAgentRunDetailResponse> {
    await this.audit.assertAuditReady();
    const row = await this.runs.getById(id);
    if (!row) {
      throw new NotFoundException({ error: 'ai_run_not_found', id });
    }
    return {
      data: this.toPublicRecord(row),
      meta: { request_id: requestId ?? this.audit.newRequestId() },
      errors: [],
    };
  }

  private toPublicRecord(row: AiAgentRunRecord): AiAgentRunPublicRecord {
    const promptVisible = this.audit.shouldStoreRawPayload();
    return {
      ...row,
      input_json: promptVisible ? row.input_json : this.audit.redactPayload(row.input_json),
      output_json: promptVisible ? row.output_json : this.audit.redactPayload(row.output_json),
      prompt_visible: promptVisible,
    };
  }
}
