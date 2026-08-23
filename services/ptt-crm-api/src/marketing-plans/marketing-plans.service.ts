import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MarketingPlansPgRepository } from './marketing-plans-pg.repository';
import { MarketingPlansSqliteRepository } from './marketing-plans-sqlite.repository';
import {
  CreateMarketingPlanBody,
  CRM_MARKETING_PLAN_STATUSES,
  PatchMarketingPlanBody,
} from './marketing-plans.types';

@Injectable()
export class MarketingPlansService {
  constructor(
    private readonly sqlite: MarketingPlansSqliteRepository,
    private readonly pg: MarketingPlansPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmMarketingPlansPg;
  }

  async list(fiscalYear?: number, status?: string, q?: string) {
    const qRaw = String(q ?? '').trim().toLowerCase();
    let st = String(status ?? 'all').trim().toLowerCase();
    if (!CRM_MARKETING_PLAN_STATUSES.includes(st as (typeof CRM_MARKETING_PLAN_STATUSES)[number]) && st !== 'all') {
      st = 'all';
    }
    const plans = this.usePg
      ? await this.pg.listPlans({
          fiscalYear,
          status: st,
          q: qRaw || undefined,
        })
      : this.sqlite.listPlans({
          fiscalYear,
          status: st,
          q: qRaw || undefined,
        });
    return { plans };
  }

  async detail(id: number) {
    const plan = this.usePg ? await this.pg.getPlanById(id) : this.sqlite.getPlanById(id);
    if (!plan) {
      throw new NotFoundException({ error: 'Không tìm thấy kế hoạch' });
    }
    const milestones = this.usePg
      ? await this.pg.listMilestones(id)
      : this.sqlite.listMilestones(id);
    const campaigns = this.usePg
      ? await this.pg.listCampaigns(id)
      : this.sqlite.listCampaigns(id);
    return { ...plan, milestones, campaigns };
  }

  async create(body: CreateMarketingPlanBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên kế hoạch' });
    }
    return this.usePg
      ? this.pg.createPlan({ ...body, name })
      : this.sqlite.createPlan({ ...body, name });
  }

  async patch(id: number, body: PatchMarketingPlanBody) {
    if ('name' in body && body.name != null) {
      const nm = String(body.name).trim();
      if (!nm) {
        throw new BadRequestException({ error: 'Tên không được trống' });
      }
    }
    const { khtn_market_research_json: _ignored, ...safe } = body;
    const updated = this.usePg
      ? await this.pg.patchPlan(id, safe)
      : this.sqlite.patchPlan(id, safe);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy kế hoạch' });
    }
    return updated;
  }

  async segmentRefs(id: number) {
    const plan = this.usePg ? await this.pg.getPlanById(id) : this.sqlite.getPlanById(id);
    if (!plan) {
      throw new NotFoundException({ error: 'Không tìm thấy kế hoạch' });
    }
    return { refs: [] };
  }
}
