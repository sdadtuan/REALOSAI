import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { catalogTs } from '../catalog/catalog-slug.util';
import { isReProjectsPgPrimary } from '../bds/inventory/bds-dual-write.util';
import { computeKpiBoardStats } from './re-projects-inventory.util';
import { ReProjectsKpiBudgetPgRepository } from './re-projects-kpi-budget-pg.repository';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import { ReProjectsSqliteRepository } from './re-projects-sqlite.repository';
import {
  RefreshLeadsNewKpiBody,
  SaveBudgetLineBody,
  SaveKpiBody,
  SaveRiskBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsKpiBudgetService {
  constructor(
    private readonly sqlite: ReProjectsSqliteRepository,
    @Optional() private readonly pgOltp?: ReProjectsPgRepository,
    @Optional() private readonly kpiBudgetPg?: ReProjectsKpiBudgetPgRepository,
  ) {}

  private pgPrimary(): boolean {
    return isReProjectsPgPrimary() && this.pgOltp != null && this.kpiBudgetPg != null;
  }

  private async assertProject(id: number): Promise<void> {
    if (this.pgPrimary()) {
      const proj = await this.pgOltp!.fetchProject(id);
      if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
      return;
    }
    if (!this.sqlite.fetchProject(id)) {
      throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    }
  }

  async listKpiMetrics(reOnly = true) {
    if (this.pgPrimary()) {
      return { metrics: await this.kpiBudgetPg!.listCrmKpiMetrics(reOnly) };
    }
    return { metrics: this.sqlite.listCrmKpiMetrics(reOnly) };
  }

  async listKpis(projectId: number) {
    if (this.pgPrimary()) {
      const kpis = await this.kpiBudgetPg!.listKpis(projectId);
      return { kpis, board: computeKpiBoardStats(kpis) };
    }
    const kpis = this.sqlite.listKpis(projectId);
    return { kpis, board: computeKpiBoardStats(kpis) };
  }

  async createKpi(projectId: number, body: SaveKpiBody) {
    await this.assertProject(projectId);
    try {
      if (this.pgPrimary()) {
        return await this.kpiBudgetPg!.saveKpi(
          projectId,
          body as Record<string, unknown>,
          undefined,
          catalogTs(),
        );
      }
      return this.sqlite.saveKpi(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateKpi(projectId: number, kpiId: number, body: SaveKpiBody) {
    try {
      if (this.pgPrimary()) {
        return await this.kpiBudgetPg!.saveKpi(
          projectId,
          body as Record<string, unknown>,
          kpiId,
          catalogTs(),
        );
      }
      return this.sqlite.saveKpi(projectId, body as Record<string, unknown>, kpiId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteKpi(projectId: number, kpiId: number) {
    if (this.pgPrimary()) {
      await this.kpiBudgetPg!.deleteKpi(projectId, kpiId);
      return { ok: true };
    }
    this.sqlite.deleteKpi(projectId, kpiId);
    return { ok: true };
  }

  async syncKpisToStaff(projectId: number) {
    await this.assertProject(projectId);
    if (this.pgPrimary()) {
      return this.kpiBudgetPg!.syncProjectKpisToStaff(projectId, catalogTs());
    }
    return this.sqlite.syncProjectKpisToStaff(projectId, catalogTs());
  }

  async pullKpisFromStaff(projectId: number) {
    await this.assertProject(projectId);
    if (this.pgPrimary()) {
      return this.kpiBudgetPg!.pullProjectKpisFromStaff(projectId, catalogTs());
    }
    return this.sqlite.pullProjectKpisFromStaff(projectId, catalogTs());
  }

  async refreshLeadsNewKpi(projectId: number, body: RefreshLeadsNewKpiBody = {}) {
    await this.assertProject(projectId);
    if (this.pgPrimary()) {
      return this.kpiBudgetPg!.refreshProjectReLeadsNewKpi(projectId, {
        periodMonth: body.period_month,
        ts: catalogTs(),
      });
    }
    return this.sqlite.refreshProjectReLeadsNewKpi(projectId, {
      periodMonth: body.period_month,
      ts: catalogTs(),
    });
  }

  async listRisks(projectId: number) {
    if (this.pgPrimary()) {
      return { risks: await this.kpiBudgetPg!.listRisks(projectId) };
    }
    return { risks: this.sqlite.listRisks(projectId) };
  }

  async createRisk(projectId: number, body: SaveRiskBody) {
    await this.assertProject(projectId);
    try {
      if (this.pgPrimary()) {
        return await this.kpiBudgetPg!.saveRisk(
          projectId,
          body as Record<string, unknown>,
          undefined,
          catalogTs(),
        );
      }
      return this.sqlite.saveRisk(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateRisk(projectId: number, riskId: number, body: SaveRiskBody) {
    try {
      if (this.pgPrimary()) {
        return await this.kpiBudgetPg!.saveRisk(
          projectId,
          body as Record<string, unknown>,
          riskId,
          catalogTs(),
        );
      }
      return this.sqlite.saveRisk(projectId, body as Record<string, unknown>, riskId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteRisk(projectId: number, riskId: number) {
    if (this.pgPrimary()) {
      await this.kpiBudgetPg!.deleteRisk(projectId, riskId);
      return { ok: true };
    }
    this.sqlite.deleteRisk(projectId, riskId);
    return { ok: true };
  }

  async listBudget(projectId: number) {
    if (this.pgPrimary()) {
      return { lines: await this.kpiBudgetPg!.listBudgetLines(projectId) };
    }
    return { lines: this.sqlite.listBudgetLines(projectId) };
  }

  async createBudgetLine(projectId: number, body: SaveBudgetLineBody) {
    await this.assertProject(projectId);
    try {
      if (this.pgPrimary()) {
        return await this.kpiBudgetPg!.saveBudgetLine(
          projectId,
          body as Record<string, unknown>,
          undefined,
          catalogTs(),
        );
      }
      return this.sqlite.saveBudgetLine(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateBudgetLine(projectId: number, lineId: number, body: SaveBudgetLineBody) {
    try {
      if (this.pgPrimary()) {
        return await this.kpiBudgetPg!.saveBudgetLine(
          projectId,
          body as Record<string, unknown>,
          lineId,
          catalogTs(),
        );
      }
      return this.sqlite.saveBudgetLine(projectId, body as Record<string, unknown>, lineId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async deleteBudgetLine(projectId: number, lineId: number) {
    if (this.pgPrimary()) {
      await this.kpiBudgetPg!.deleteBudgetLine(projectId, lineId);
      return { ok: true };
    }
    this.sqlite.deleteBudgetLine(projectId, lineId);
    return { ok: true };
  }
}
