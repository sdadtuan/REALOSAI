import { Injectable } from '@nestjs/common';
import { ServiceLifecyclePgRepository } from '../service-lifecycle/service-lifecycle-pg.repository';

@Injectable()
export class LaunchQaLifecycleLookupService {
  constructor(private readonly lifecyclePg: ServiceLifecyclePgRepository) {}

  async buildLifecycleIndex(): Promise<Map<string, number>> {
    return this.lifecyclePg.buildLaunchQaLifecycleIndex();
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
