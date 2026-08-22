import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktPillarRow } from './content-marketing.types';

@Injectable()
export class ContentPillarService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listPillars(lifecycleId: number): Promise<{ pillars: CmktPillarRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const pillars = await this.repo.listPillars(lifecycleId);
    return { pillars };
  }

  async patchPillar(
    lifecycleId: number,
    pillarId: number,
    body: Record<string, unknown>,
  ): Promise<{ pillar: CmktPillarRow }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getPillarById(lifecycleId, pillarId);
    if (!existing) throw new NotFoundException({ error: 'pillar_not_found', id: pillarId });

    const patch: Partial<CmktPillarRow> = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException({ error: 'pillar_name_required' });
      patch.name = name;
    }
    if (body.goal != null) patch.goal = String(body.goal).trim();
    if (body.topics_json != null) {
      patch.topics_json = Array.isArray(body.topics_json)
        ? body.topics_json.map((v) => String(v).trim()).filter(Boolean)
        : [];
    }
    if (body.sort_order != null) {
      const sort = Number(body.sort_order);
      if (!Number.isFinite(sort)) throw new BadRequestException({ error: 'invalid_sort_order' });
      patch.sort_order = Math.floor(sort);
    }

    const pillar = await this.repo.patchPillar(lifecycleId, pillarId, patch);
    if (!pillar) throw new NotFoundException({ error: 'pillar_not_found', id: pillarId });
    return { pillar };
  }
}
