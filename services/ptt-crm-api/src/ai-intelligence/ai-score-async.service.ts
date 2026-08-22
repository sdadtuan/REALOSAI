import { Injectable, Logger } from '@nestjs/common';
import { EnqueuedJob, JobQueueRepository } from '../webhooks/job-queue.repository';
import { AiIntelligenceConfigService } from './ai-intelligence.config';

/** RNOS-08 — enqueue score_lead job after LeadCreated (AI-UC-001 async path). */
@Injectable()
export class AiScoreAsyncService {
  private readonly logger = new Logger(AiScoreAsyncService.name);

  constructor(
    private readonly jobQueue: JobQueueRepository,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  isScoreAsyncEnabled(): boolean {
    return this.aiConfig.scoreAsync;
  }

  async enqueueAfterLeadCreated(input: {
    leadId: number;
    clientId?: string | null;
    correlationId?: string | null;
  }): Promise<EnqueuedJob | null> {
    if (!this.isScoreAsyncEnabled()) {
      return null;
    }
    try {
      const job = await this.jobQueue.enqueueScoreLeadJob({
        leadId: input.leadId,
        clientId: input.clientId,
        correlationId: input.correlationId ?? undefined,
      });
      if (job?.created) {
        this.logger.debug(`score_lead enqueued lead=${input.leadId}`);
      }
      return job;
    } catch (err) {
      this.logger.warn(`score_lead enqueue skipped lead=${input.leadId}: ${String(err)}`);
      return null;
    }
  }
}
