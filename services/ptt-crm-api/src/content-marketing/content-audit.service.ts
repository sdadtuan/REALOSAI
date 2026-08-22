import { Injectable } from '@nestjs/common';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktAuditRow } from './content-marketing.types';

@Injectable()
export class ContentAuditService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listAudit(lifecycleId: number, limit?: number): Promise<{ audit: CmktAuditRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const audit = await this.repo.listAudit(lifecycleId, limit ?? 50);
    return { audit };
  }
}
