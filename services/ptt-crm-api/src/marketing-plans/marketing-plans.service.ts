import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketingPlansPgRepository } from './marketing-plans-pg.repository';
import {
  CreateMarketingPlanBody,
  CRM_MARKETING_PLAN_STATUSES,
  PatchMarketingPlanBody,
} from './marketing-plans.types';

@Injectable()
export class MarketingPlansService {
  constructor(private readonly pg: MarketingPlansPgRepository) {}

  async list(fiscalYear?: number, status?: string, q?: string) {
    const qRaw = String(q ?? '').trim().toLowerCase();
    let st = String(status ?? 'all').trim().toLowerCase();
    if (!CRM_MARKETING_PLAN_STATUSES.includes(st as (typeof CRM_MARKETING_PLAN_STATUSES)[number]) && st !== 'all') {
      st = 'all';
    }
    const plans = await this.pg.listPlans({
      fiscalYear,
      status: st,
      q: qRaw || undefined,
    });
    return { plans };
  }

  async detail(id: number) {
    const plan = await this.pg.getPlanById(id);
    if (!plan) {
      throw new NotFoundException({ error: 'Không tìm thấy kế hoạch' });
    }
    const milestones = await this.pg.listMilestones(id);
    const campaigns = await this.pg.listCampaigns(id);
    return { ...plan, milestones, campaigns };
  }

  async create(body: CreateMarketingPlanBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên kế hoạch' });
    }
    return this.pg.createPlan({ ...body, name });
  }

  async patch(id: number, body: PatchMarketingPlanBody) {
    if ('name' in body && body.name != null) {
      const nm = String(body.name).trim();
      if (!nm) {
        throw new BadRequestException({ error: 'Tên không được trống' });
      }
    }
    const { khtn_market_research_json: _ignored, ...safe } = body;
    const updated = await this.pg.patchPlan(id, safe);
    if (!updated) {
      throw new NotFoundException({ error: 'Không tìm thấy kế hoạch' });
    }
    return updated;
  }

  async segmentRefs(id: number) {
    const plan = await this.pg.getPlanById(id);
    if (!plan) {
      throw new NotFoundException({ error: 'Không tìm thấy kế hoạch' });
    }
    return { refs: [] };
  }
}
