import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { isBdsProjectOsEnabled } from '../bds/bds.flags';
import { isReProjectsPgPrimary } from '../bds/inventory/bds-dual-write.util';
import { BdsProjectOsService } from '../bds/project-os/bds-project-os.service';
import { buildExportJsonBundle, ExportReportType } from './re-projects-export.util';
import { ReProjectsLeadConfigPgRepository } from './re-projects-lead-config-pg.repository';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import { ReProjectsSqliteRepository } from './re-projects-sqlite.repository';
import { ReProjectsStaffPgRepository } from './re-projects-staff-pg.repository';
import {
  AddProjectStaffBody,
  SaveProjectLeadConfigBody,
  UpdateProjectStaffBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsOpsService {
  constructor(
    private readonly sqlite: ReProjectsSqliteRepository,
    private readonly projectOs: BdsProjectOsService,
    @Optional() private readonly pgOltp?: ReProjectsPgRepository,
    @Optional() private readonly leadConfigPg?: ReProjectsLeadConfigPgRepository,
    @Optional() private readonly staffPg?: ReProjectsStaffPgRepository,
  ) {}

  private pgPrimary(): boolean {
    return isReProjectsPgPrimary() && this.pgOltp != null;
  }

  async listStaff(projectId: number) {
    try {
      if (this.pgPrimary() && this.staffPg) {
        const staff = await this.staffPg.listProjectStaff(projectId, true);
        return { project_id: projectId, staff };
      }
      const staff = this.sqlite.listProjectStaff(projectId, true);
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
      if (this.pgPrimary() && this.staffPg) {
        const staff = await this.staffPg.addProjectStaff(projectId, {
          staff_id: staffId,
          role: String(body.role ?? 'sales'),
          assign_enabled: body.assign_enabled ?? true,
          sort_order: Number(body.sort_order ?? 0),
          scope_product_lines: Array.isArray(body.scope_product_lines) ? body.scope_product_lines : undefined,
          scope_zones: Array.isArray(body.scope_zones) ? body.scope_zones : undefined,
        });
        return { staff };
      }
      const staff = this.sqlite.addProjectStaff(projectId, {
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
      if (this.pgPrimary() && this.staffPg) {
        const staff = await this.staffPg.updateProjectStaff(projectId, staffId, body);
        return { staff };
      }
      const staff = this.sqlite.updateProjectStaff(projectId, staffId, body);
      return { staff };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async removeStaff(projectId: number, staffId: number) {
    try {
      if (this.pgPrimary() && this.staffPg) {
        await this.staffPg.removeProjectStaff(projectId, staffId);
        return { ok: true };
      }
      this.sqlite.removeProjectStaff(projectId, staffId);
      return { ok: true };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async getLeadConfig(projectId: number) {
    try {
      if (this.pgPrimary() && this.leadConfigPg) {
        const config = await this.leadConfigPg.getProjectLeadConfig(projectId);
        return { config };
      }
      const config = this.sqlite.getProjectLeadConfig(projectId);
      return { config };
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }

  async saveLeadConfig(projectId: number, body: SaveProjectLeadConfigBody, updatedBy = '') {
    try {
      if (this.pgPrimary() && this.leadConfigPg) {
        const config = await this.leadConfigPg.saveProjectLeadConfig(projectId, body, updatedBy);
        return { config };
      }
      const config = this.sqlite.saveProjectLeadConfig(projectId, body, updatedBy);
      return { config };
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
  }

  async webhookTest(projectId: number) {
    if (this.pgPrimary() && this.pgOltp) {
      const proj = await this.pgOltp.fetchProject(projectId);
      if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
      return { ok: true, stub: true };
    }
    const proj = this.sqlite.fetchProject(projectId);
    if (!proj) throw new NotFoundException({ error: 'Không tìm thấy dự án.' });
    return { ok: true, stub: true };
  }

  async workflow(projectId: number) {
    try {
      if (isBdsProjectOsEnabled()) {
        const approvedKinds = await this.projectOs.latestApprovedKinds(projectId);
        return this.sqlite.computeProjectWorkflow(projectId, approvedKinds);
      }
      return this.sqlite.computeProjectWorkflow(projectId);
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
      const pack = this.sqlite.fetchProjectExportData(projectId, approvedKinds);
      return buildExportJsonBundle(reportType, {
        project: pack.project,
        summary: pack.summary,
        workflow: pack.workflow,
        kpis: pack.kpis,
        products: pack.products,
        risks: pack.risks,
        budget: pack.budget,
      });
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('Không tìm thấy')) throw new NotFoundException({ error: msg });
      throw new BadRequestException({ error: msg });
    }
  }
}
