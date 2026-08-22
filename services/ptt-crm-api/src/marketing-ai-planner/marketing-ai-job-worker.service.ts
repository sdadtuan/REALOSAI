import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiMultiAgentService } from './marketing-ai-multi-agent.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';

const TICK_MS = 5 * 60 * 1000;

@Injectable()
export class MarketingAiJobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketingAiJobWorkerService.name);
  private timer?: NodeJS.Timeout;
  private readonly inFlight = new Set<number>();

  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
    @Inject(forwardRef(() => MarketingAiMultiAgentService))
    private readonly multiAgent: MarketingAiMultiAgentService,
  ) {}

  onModuleInit(): void {
    if (!this.config.mktAiMultiAgentAsync || !this.multiAgent.isEnabled()) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  triggerJob(jobId: number): void {
    void this.runJob(jobId);
  }

  async tick(): Promise<void> {
    const pending = await this.repo.listPendingMultiAgentJobs(10);
    for (const job of pending) {
      await this.runJob(job.id);
    }
  }

  private async runJob(jobId: number): Promise<void> {
    if (this.inFlight.has(jobId)) return;
    this.inFlight.add(jobId);
    try {
      const claimed = await this.repo.claimPendingMultiAgentJob(jobId);
      if (!claimed) return;
      await this.multiAgent.executePipeline(jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`multi_agent job ${jobId} failed: ${message}`);
      await this.repo.finishJob(jobId, {
        status: 'failed',
        error_message: message,
        latency_ms: 0,
      });
    } finally {
      this.inFlight.delete(jobId);
    }
  }
}
