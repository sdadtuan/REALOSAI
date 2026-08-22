import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecyclePgRepository } from '../service-lifecycle/service-lifecycle-pg.repository';
import { ServiceLifecycleSqliteRepository } from '../service-lifecycle/service-lifecycle-sqlite.repository';

@Injectable()
export class LaunchQaLifecycleLookupService {
  constructor(
    private readonly lifecycleSqlite: ServiceLifecycleSqliteRepository,
    private readonly lifecyclePg: ServiceLifecyclePgRepository,
    private readonly config: AppConfigService,
  ) {}

  async buildLifecycleIndex(): Promise<Map<string, number>> {
    if (this.config.crmServiceLifecyclePg) {
      return this.lifecyclePg.buildLaunchQaLifecycleIndex();
    }
    return this.lifecycleSqlite.buildLaunchQaLifecycleIndex();
  }

  resolveLifecycleId(
    index: Map<string, number>,
    clientId: string,
    externalCampaignId: string,
  ): number | null {
    const key = `${clientId.trim()}:${externalCampaignId.trim()}`;
    const id = index.get(key);
    return id && id > 0 ? id : null;
  }
}
