import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { catalogTs } from '../catalog/catalog-slug.util';
import { isReProjectsPgPrimary } from '../bds/inventory/bds-dual-write.util';
import { computeKpiBoardStats } from './re-projects-inventory.util';
import { ReProjectsKpiBudgetPgRepository } from './re-projects-kpi-budget-pg.repository';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import {
  RefreshLeadsNewKpiBody,
  SaveBudgetLineBody,
  SaveKpiBody,
  SaveRiskBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsKpiBudgetService {
  constructor(
    private readonly config: AppConfigService,
    @Optional() private readonly pgOltp?: ReProjectsPgRepository,
    @Optional() private readonly kpiBudgetPg?: ReProjectsKpiBudgetPgRepository,
  ) {}

  private pgPrimary(): boolean {
    return isReProjectsPgPrimary() && this.pgOltp != null && this.kpiBudgetPg != null;
  }

  private requirePgPrimary(): void {
    if (this.config.sqliteDisabled && !this.pgPrimary()) {
      throw new ServiceUnavailableException({
        error: 'bds_re_projects_pg_required',
        message: 'BĐS re-projects requires PostgreSQL when SQLite is disabled',
        hint: 'Set PTT_BDS_PACK=1 and PTT_BDS_PG=1',
      });
    }
    if (!this.pgPrimary()) {
      throw new ServiceUnavailableException({
        error: 'bds_re_projects_pg_required',
        message: 'BĐS re-projects requires PostgreSQL',
        hint: 'Set PTT_BDS_PACK=1 and PTT_BDS_PG=1',
      });
    }
  }

  private async assertProject(id: number): Promise<void> {
    this.requirePgPrimary();
    const proj = await this.pgOltp!.fetchProject(id);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
  }

  async listKpiMetrics(reOnly = true) {
    this.requirePgPrimary();
    return { metrics: await this.kpiBudgetPg!.listCrmKpiMetrics(reOnly) };
  }

  async listKpis(projectId: number) {
    this.requirePgPrimary();
    const kpis = await this.kpiBudgetPg!.listKpis(projectId);
    return { kpis, board: computeKpiBoardStats(kpis) };
  }

  async createKpi(projectId: number, body: SaveKpiBody) {
    await this.assertProject(projectId);
    try {
      this.requirePgPrimary();
      return await this.kpiBudgetPg!.saveKpi(
        projectId,
        body as Record<string, unknown>,
        undefined,
        catalogTs(),
      );
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateKpi(projectId: number, kpiId: number, body: SaveKpiBody) {
    try {
      this.requirePgPrimary();
      return await this.kpiBudgetPg!.saveKpi(
        projectId,
        body as Record<string, unknown>,
        kpiId,
        catalogTs(),
      );
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteKpi(projectId: number, kpiId: number) {
    this.requirePgPrimary();
    await this.kpiBudgetPg!.deleteKpi(projectId, kpiId);
    return { ok: true };
  }

  async syncKpisToStaff(projectId: number) {
    await this.assertProject(projectId);
    this.requirePgPrimary();
    return this.kpiBudgetPg!.syncProjectKpisToStaff(projectId, catalogTs());
  }

  async pullKpisFromStaff(projectId: number) {
    await this.assertProject(projectId);
    this.requirePgPrimary();
    return this.kpiBudgetPg!.pullProjectKpisFromStaff(projectId, catalogTs());
  }

  async refreshLeadsNewKpi(projectId: number, body: RefreshLeadsNewKpiBody = {}) {
    await this.assertProject(projectId);
    this.requirePgPrimary();
    return this.kpiBudgetPg!.refreshProjectReLeadsNewKpi(projectId, {
      periodMonth: body.period_month,
      ts: catalogTs(),
    });
  }

  async listRisks(projectId: number) {
    this.requirePgPrimary();
    return { risks: await this.kpiBudgetPg!.listRisks(projectId) };
  }

  async createRisk(projectId: number, body: SaveRiskBody) {
    await this.assertProject(projectId);
    try {
      this.requirePgPrimary();
      return await this.kpiBudgetPg!.saveRisk(
        projectId,
        body as Record<string, unknown>,
        undefined,
        catalogTs(),
      );
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateRisk(projectId: number, riskId: number, body: SaveRiskBody) {
    try {
      this.requirePgPrimary();
      return await this.kpiBudgetPg!.saveRisk(
        projectId,
        body as Record<string, unknown>,
        riskId,
        catalogTs(),
      );
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteRisk(projectId: number, riskId: number) {
    this.requirePgPrimary();
    await this.kpiBudgetPg!.deleteRisk(projectId, riskId);
    return { ok: true };
  }

  async listBudget(projectId: number) {
    this.requirePgPrimary();
    return { lines: await this.kpiBudgetPg!.listBudgetLines(projectId) };
  }

  async createBudgetLine(projectId: number, body: SaveBudgetLineBody) {
    await this.assertProject(projectId);
    try {
      this.requirePgPrimary();
      return await this.kpiBudgetPg!.saveBudgetLine(
        projectId,
        body as Record<string, unknown>,
        undefined,
        catalogTs(),
      );
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateBudgetLine(projectId: number, lineId: number, body: SaveBudgetLineBody) {
    try {
      this.requirePgPrimary();
      return await this.kpiBudgetPg!.saveBudgetLine(
        projectId,
        body as Record<string, unknown>,
        lineId,
        catalogTs(),
      );
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteBudgetLine(projectId: number, lineId: number) {
    this.requirePgPrimary();
    await this.kpiBudgetPg!.deleteBudgetLine(projectId, lineId);
    return { ok: true };
  }
}
