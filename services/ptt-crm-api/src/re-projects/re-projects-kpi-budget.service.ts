import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { catalogTs } from '../catalog/catalog-slug.util';
import { isReProjectsPgPrimary } from '../bds/inventory/bds-dual-write.util';
import { computeKpiBoardStats } from './re-projects-inventory.util';
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
  ) {}

  private pgPrimary(): boolean {
    return isReProjectsPgPrimary() && this.pgOltp != null;
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

  listKpiMetrics(reOnly = true) {
    if (this.pgPrimary()) return { metrics: [] };
    return { metrics: this.sqlite.listCrmKpiMetrics(reOnly) };
  }

  listKpis(projectId: number) {
    if (this.pgPrimary()) {
      return { kpis: [], board: computeKpiBoardStats([]) };
    }
    const kpis = this.sqlite.listKpis(projectId);
    return { kpis, board: computeKpiBoardStats(kpis) };
  }

  async createKpi(projectId: number, body: SaveKpiBody) {
    if (this.pgPrimary()) {
      await this.assertProject(projectId);
      throw new BadRequestException({ error: 'KPI dự án chưa migrate sang PostgreSQL.' });
    }
    try {
      return this.sqlite.saveKpi(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateKpi(projectId: number, kpiId: number, body: SaveKpiBody) {
    if (this.pgPrimary()) {
      throw new BadRequestException({ error: 'KPI dự án chưa migrate sang PostgreSQL.' });
    }
    try {
      return this.sqlite.saveKpi(projectId, body as Record<string, unknown>, kpiId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  deleteKpi(projectId: number, kpiId: number) {
    if (this.pgPrimary()) {
      throw new BadRequestException({ error: 'KPI dự án chưa migrate sang PostgreSQL.' });
    }
    this.sqlite.deleteKpi(projectId, kpiId);
    return { ok: true };
  }

  async syncKpisToStaff(projectId: number) {
    await this.assertProject(projectId);
    if (this.pgPrimary()) {
      return { synced: 0, skipped: 0, total: 0 };
    }
    return this.sqlite.syncProjectKpisToStaff(projectId, catalogTs());
  }

  async pullKpisFromStaff(projectId: number) {
    await this.assertProject(projectId);
    if (this.pgPrimary()) {
      return { updated: 0, total_linked: 0 };
    }
    return this.sqlite.pullProjectKpisFromStaff(projectId, catalogTs());
  }

  async refreshLeadsNewKpi(projectId: number, body: RefreshLeadsNewKpiBody = {}) {
    await this.assertProject(projectId);
    if (this.pgPrimary()) {
      return { refreshed: false, reason: 'pg_oltp' };
    }
    return this.sqlite.refreshProjectReLeadsNewKpi(projectId, {
      periodMonth: body.period_month,
      ts: catalogTs(),
    });
  }

  listRisks(projectId: number) {
    if (this.pgPrimary()) return { risks: [] };
    return { risks: this.sqlite.listRisks(projectId) };
  }

  async createRisk(projectId: number, body: SaveRiskBody) {
    if (this.pgPrimary()) {
      await this.assertProject(projectId);
      throw new BadRequestException({ error: 'Rủi ro dự án chưa migrate sang PostgreSQL.' });
    }
    try {
      return this.sqlite.saveRisk(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateRisk(projectId: number, riskId: number, body: SaveRiskBody) {
    if (this.pgPrimary()) {
      throw new BadRequestException({ error: 'Rủi ro dự án chưa migrate sang PostgreSQL.' });
    }
    try {
      return this.sqlite.saveRisk(projectId, body as Record<string, unknown>, riskId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  deleteRisk(projectId: number, riskId: number) {
    if (this.pgPrimary()) {
      throw new BadRequestException({ error: 'Rủi ro dự án chưa migrate sang PostgreSQL.' });
    }
    this.sqlite.deleteRisk(projectId, riskId);
    return { ok: true };
  }

  listBudget(projectId: number) {
    if (this.pgPrimary()) return { lines: [] };
    return { lines: this.sqlite.listBudgetLines(projectId) };
  }

  async createBudgetLine(projectId: number, body: SaveBudgetLineBody) {
    if (this.pgPrimary()) {
      await this.assertProject(projectId);
      throw new BadRequestException({ error: 'Ngân sách dự án chưa migrate sang PostgreSQL.' });
    }
    try {
      return this.sqlite.saveBudgetLine(projectId, body as Record<string, unknown>, undefined, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateBudgetLine(projectId: number, lineId: number, body: SaveBudgetLineBody) {
    if (this.pgPrimary()) {
      throw new BadRequestException({ error: 'Ngân sách dự án chưa migrate sang PostgreSQL.' });
    }
    try {
      return this.sqlite.saveBudgetLine(projectId, body as Record<string, unknown>, lineId, catalogTs());
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  deleteBudgetLine(projectId: number, lineId: number) {
    if (this.pgPrimary()) {
      throw new BadRequestException({ error: 'Ngân sách dự án chưa migrate sang PostgreSQL.' });
    }
    this.sqlite.deleteBudgetLine(projectId, lineId);
    return { ok: true };
  }
}
