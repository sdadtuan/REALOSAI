import { BadRequestException, Injectable } from '@nestjs/common';
import { SalesPgRepository } from './sales-pg.repository';
import {
  CreateMarketBody,
  CreatePartnerBody,
  CreateSalesPlanBody,
  CreateTrainingBody,
} from './sales.types';

@Injectable()
export class SalesService {
  constructor(private readonly pg: SalesPgRepository) {}

  summary() {
    return this.pg.fetchSummary();
  }

  async listPlans() {
    const plans = await this.pg.listPlans();
    return { plans };
  }

  async createPlan(body: CreateSalesPlanBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tên kế hoạch' });
    }
    return this.pg.createPlan({ ...body, title });
  }

  listPipelineCases(stage?: string) {
    return this.pg.listPipelineCases(stage).then((cases) => ({ cases }));
  }

  async listPartners(q?: string) {
    const partners = await this.pg.listPartners(q);
    return { partners };
  }

  createPartner(body: CreatePartnerBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên đối tác' });
    }
    return this.pg.createPartner({ ...body, name });
  }

  async listTrainings() {
    const trainings = await this.pg.listTrainings();
    return { trainings };
  }

  createTraining(body: CreateTrainingBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tiêu đề' });
    }
    return this.pg.createTraining({ ...body, title });
  }

  async listMarket() {
    const research = await this.pg.listMarketResearch();
    return { research };
  }

  createMarket(body: CreateMarketBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tiêu đề' });
    }
    return this.pg.createMarketResearch({ ...body, title });
  }

  async listTransactions() {
    const transactions = await this.pg.listTransactions();
    return { transactions };
  }

  salesReport() {
    return this.pg.fetchSalesReport();
  }
}
