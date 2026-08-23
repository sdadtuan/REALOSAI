import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SalesPgRepository } from './sales-pg.repository';
import { SalesSqliteRepository } from './sales-sqlite.repository';
import {
  CreateMarketBody,
  CreatePartnerBody,
  CreateSalesPlanBody,
  CreateTrainingBody,
} from './sales.types';

@Injectable()
export class SalesService {
  constructor(
    private readonly sqlite: SalesSqliteRepository,
    private readonly pg: SalesPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmSalesPg;
  }

  summary() {
    return this.usePg ? this.pg.fetchSummary() : this.sqlite.fetchSummary();
  }

  async listPlans() {
    const plans = this.usePg ? await this.pg.listPlans() : this.sqlite.listPlans();
    return { plans };
  }

  async createPlan(body: CreateSalesPlanBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tên kế hoạch' });
    }
    return this.usePg ? this.pg.createPlan({ ...body, title }) : this.sqlite.createPlan({ ...body, title });
  }

  listPipelineCases(stage?: string) {
    return this.usePg
      ? this.pg.listPipelineCases(stage).then((cases) => ({ cases }))
      : this.sqlite.listPipelineCases(stage).then((cases) => ({ cases }));
  }

  async listPartners(q?: string) {
    const partners = this.usePg ? await this.pg.listPartners(q) : this.sqlite.listPartners(q);
    return { partners };
  }

  createPartner(body: CreatePartnerBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên đối tác' });
    }
    return this.usePg
      ? this.pg.createPartner({ ...body, name })
      : this.sqlite.createPartner({ ...body, name });
  }

  async listTrainings() {
    const trainings = this.usePg ? await this.pg.listTrainings() : this.sqlite.listTrainings();
    return { trainings };
  }

  createTraining(body: CreateTrainingBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tiêu đề' });
    }
    return this.usePg
      ? this.pg.createTraining({ ...body, title })
      : this.sqlite.createTraining({ ...body, title });
  }

  async listMarket() {
    const research = this.usePg ? await this.pg.listMarketResearch() : this.sqlite.listMarketResearch();
    return { research };
  }

  createMarket(body: CreateMarketBody) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'Thiếu tiêu đề' });
    }
    return this.usePg
      ? this.pg.createMarketResearch({ ...body, title })
      : this.sqlite.createMarketResearch({ ...body, title });
  }

  async listTransactions() {
    const transactions = this.usePg ? await this.pg.listTransactions() : this.sqlite.listTransactions();
    return { transactions };
  }

  salesReport() {
    return this.usePg ? this.pg.fetchSalesReport() : this.sqlite.fetchSalesReport();
  }
}
