import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  assignAbBucket,
  outcomeWonFromStatus,
  type RoutingAbBucket,
} from './b2b-routing-ab.util';
import { B2bRoutingAbRepository } from './b2b-routing-ab.repository';

@Injectable()
export class B2bRoutingAbService {
  constructor(
    private readonly repo: B2bRoutingAbRepository,
    private readonly config: AppConfigService,
  ) {}

  bucketForLead(leadId: number): RoutingAbBucket {
    return assignAbBucket(leadId);
  }

  async recordFirstAssign(input: {
    leadId: number;
    strategy: 'ai_analytics' | 'hybrid' | 'hybrid_timeout';
  }): Promise<void> {
    if (!this.config.b2bProjectOs) return;
    if (!(await this.repo.tableReady())) return;
    await this.repo.upsertFirstAssign({
      leadId: input.leadId,
      bucket: assignAbBucket(input.leadId),
      strategy: input.strategy,
    });
  }

  async recordStatusOutcome(input: {
    leadId: number;
    status: string;
  }): Promise<boolean> {
    if (!this.config.b2bProjectOs) return false;
    if (!(await this.repo.tableReady())) return false;
    const won = outcomeWonFromStatus(input.status);
    if (won == null) return false;
    return this.repo.recordOutcome({ leadId: input.leadId, won });
  }

  async getReport(days = 30): Promise<{
    ai_win_rate: number | null;
    hybrid_win_rate: number | null;
    n: number;
  }> {
    if (!(await this.repo.tableReady())) {
      return { ai_win_rate: null, hybrid_win_rate: null, n: 0 };
    }
    return this.repo.loadReport(days);
  }
}
