import { Injectable } from '@nestjs/common';
import type { PublicStatusResponse } from './gtm-public-status.types';
import { GtmRepository } from './gtm.repository';

const SLA_TARGET = 99.9;
const REGION_SG = 'Singapore';

@Injectable()
export class GtmPublicStatusService {
  constructor(private readonly repo: GtmRepository) {}

  async getPublicStatus(): Promise<PublicStatusResponse> {
    const [demoOk, cmsOk] = await Promise.all([this.repo.pingDb(), this.repo.pingCmsTable()]);

    return {
      updated_at: new Date().toISOString(),
      sla_target_pct: SLA_TARGET,
      components: [
        {
          id: 'marketing_site',
          name: 'Marketing site',
          status: 'operational',
          region: 'Global CDN',
        },
        {
          id: 'demo_api',
          name: 'Demo request API',
          status: demoOk ? 'operational' : 'outage',
          region: REGION_SG,
        },
        {
          id: 'cms_read',
          name: 'Public CMS read',
          status: cmsOk ? 'operational' : demoOk ? 'degraded' : 'outage',
          region: REGION_SG,
        },
      ],
    };
  }
}
