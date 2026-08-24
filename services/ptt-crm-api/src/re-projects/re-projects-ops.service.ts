import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { isBdsProjectOsEnabled } from '../bds/bds.flags';
import { BdsReProductPgRepository } from '../bds/inventory/bds-re-product-pg.repository';
import { isReProjectsPgPrimary } from '../bds/inventory/bds-dual-write.util';
import { BdsProjectOsService } from '../bds/project-os/bds-project-os.service';
import { buildExportJsonBundle, ExportReportType } from './re-projects-export.util';
import { ReProjectsKpiBudgetPgRepository } from './re-projects-kpi-budget-pg.repository';
import { ReProjectsLeadConfigPgRepository } from './re-projects-lead-config-pg.repository';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import { ReProjectsStaffPgRepository } from './re-projects-staff-pg.repository';
import { buildProjectSummaryFromParts } from './re-projects-summary.util';
import { computeProjectWorkflow } from './re-projects-workflow.util';
import {
  AddProjectStaffBody,
  SaveProjectLeadConfigBody,
  UpdateProjectStaffBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsOpsService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projectOs: BdsProjectOsService,
    @Optional() private readonly pgOltp?: ReProjectsPgRepository,
    @Optional() private readonly leadConfigPg?: ReProjectsLeadConfigPgRepository,
    @Optional() private readonly staffPg?: ReProjectsStaffPgRepository,
    @Optional() private readonly kpiBudgetPg?: ReProjectsKpiBudgetPgRepository,
    @Optional() private readonly productPg?: BdsReProductPgRepository,
  ) {}

  private pgPrimary(): boolean {
    return isReProjectsPgPrimary() && this.pgOltp != null;
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

  async listStaff(projectId: number) {
    try {
      this.requirePgPrimary();
      const staff = await this.staffPg!.listProjectStaff(projectId, true);
      return { project_id: projectId, staff };
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async addStaff(projectId: number, body: AddProjectStaffBody) {
    const staffId = Number(body.staff_id ?? 0);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      throw new BadRequestException({ error: 'Thiếu staff_id.' });
    }
    try {
      this.requirePgPrimary();
      const staff = await this.staffPg!.addProjectStaff(projectId, {
        staff_id: staffId,
        role: String(body.role ?? 'sales'),
        assign_enabled: body.assign_enabled ?? true,
        sort_order: Number(body.sort_order ?? 0),
        scope_product_lines: Array.isArray(body.scope_product_lines) ? body.scope_product_lines : undefined,
        scope_zones: Array.isArray(body.scope_zones) ? body.scope_zones : undefined,
      });
      return { staff };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async updateStaff(projectId: number, staffId: number, body: UpdateProjectStaffBody) {
    try {
      this.requirePgPrimary();
      const staff = await this.staffPg!.updateProjectStaff(projectId, staffId, body);
      return { staff };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async removeStaff(projectId: number, staffId: number) {
    try {
      this.requirePgPrimary();
      await this.staffPg!.removeProjectStaff(projectId, staffId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getLeadConfig(projectId: number) {
    try {
      this.requirePgPrimary();
      const config = await this.leadConfigPg!.getProjectLeadConfig(projectId);
      return { config };
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async saveLeadConfig(projectId: number, body: SaveProjectLeadConfigBody, updatedBy = '') {
    try {
      this.requirePgPrimary();
      const config = await this.leadConfigPg!.saveProjectLeadConfig(projectId, body, updatedBy);
      return { config };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async webhookTest(projectId: number) {
    this.requirePgPrimary();
    const proj = await this.pgOltp!.fetchProject(projectId);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    return { ok: true, stub: true };
  }

  async workflow(projectId: number) {
    try {
      this.requirePgPrimary();
      let approvedKinds: string[] | undefined;
      if (isBdsProjectOsEnabled()) {
        approvedKinds = await this.projectOs.latestApprovedKinds(projectId);
      }
      const proj = await this.pgOltp!.fetchProject(projectId);
      if (!proj) throw new Error('Không tìm thấy dự án.');
      const products = await this.productPg!.listEnrichedByProject(projectId);
      const [kpis, risks, budget] = await Promise.all([
        this.kpiBudgetPg!.listKpis(projectId),
        this.kpiBudgetPg!.listRisks(projectId),
        this.kpiBudgetPg!.listBudgetLines(projectId),
      ]);
      const summary = buildProjectSummaryFromParts(proj, products, kpis, risks, budget);
      return computeProjectWorkflow(
        projectId,
        proj,
        summary,
        approvedKinds !== undefined ? { approvedKinds } : undefined,
      );
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async exportBundle(projectId: number, reportRaw?: string) {
    const report = (String(reportRaw ?? 'full').trim().toLowerCase() || 'full') as ExportReportType;
    const allowed: ExportReportType[] = [
      'full',
      'summary',
      'workflow',
      'kpis',
      'products',
      'risks',
      'budget',
      'plans',
    ];
    const reportType = allowed.includes(report) ? report : 'full';
    try {
      let approvedKinds: string[] | undefined;
      if (isBdsProjectOsEnabled()) {
        approvedKinds = await this.projectOs.latestApprovedKinds(projectId);
      }
      this.requirePgPrimary();
      const proj = await this.pgOltp!.fetchProject(projectId);
      if (!proj) throw new Error('Không tìm thấy dự án.');
      const products = await this.productPg!.listEnrichedByProject(projectId);
      const [kpis, risks, budget] = await Promise.all([
        this.kpiBudgetPg!.listKpis(projectId),
        this.kpiBudgetPg!.listRisks(projectId),
        this.kpiBudgetPg!.listBudgetLines(projectId),
      ]);
      const summary = buildProjectSummaryFromParts(proj, products, kpis, risks, budget);
      const workflow = computeProjectWorkflow(
        projectId,
        proj,
        summary,
        approvedKinds !== undefined ? { approvedKinds } : undefined,
      );
      return buildExportJsonBundle(reportType, {
        project: proj,
        summary,
        workflow,
        kpis,
        products,
        risks,
        budget,
      });
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }
}
