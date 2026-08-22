import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminAuditRepository } from '../admin-audit/admin-audit.repository';
import { AppConfigService } from '../config/app-config.service';
import {
  catalogActionLabel,
  loadStaffPermissionCatalog,
} from './staff-permissions.catalog';
import { StaffPermissionsRepository } from './staff-permissions.repository';
import type {
  PatchStaffJobFunctionGrantsBody,
  PatchStaffPositionGrantsBody,
  StaffJobFunctionDetail,
  StaffJobFunctionSummary,
} from './staff-permissions.types';
import { StaffJobFunctionsRepository } from './staff-job-functions.repository';
import { listFieldRegistryEntries, loadFieldRegistry } from './field-level.registry';

@Injectable()
export class StaffPermissionsService {
  constructor(
    private readonly repo: StaffPermissionsRepository,
    private readonly jobFunctions: StaffJobFunctionsRepository,
    private readonly adminAudit: AdminAuditRepository,
    private readonly config: AppConfigService,
  ) {}

  getCatalog() {
    const catalog = loadStaffPermissionCatalog();
    return {
      version: catalog.version,
      actions: catalog.actions,
      extra_actions: catalog.extra_actions,
      extra_action_labels: catalog.extra_action_labels,
      sections: catalog.sections,
      ui_buttons: catalog.ui_buttons,
      section_actions: catalog.section_actions,
    };
  }

  getFieldRegistry() {
    const doc = loadFieldRegistry();
    return {
      version: doc.version,
      fields: listFieldRegistryEntries(),
    };
  }

  listPositions() {
    return this.repo.listPositions();
  }

  async getPosition(positionId: number) {
    const detail = await this.repo.buildPositionDetail(positionId);
    if (!detail) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });
    return detail;
  }

  async patchPosition(
    positionId: number,
    body: PatchStaffPositionGrantsBody,
    actorEmail: string,
    options?: { bypassApproval?: boolean },
  ) {
    if (this.config.adminMatrixApprovalRequired && !options?.bypassApproval) {
      throw new BadRequestException({
        error: 'matrix_approval_required',
        message:
          'Direct matrix PATCH is disabled. Create a change request via POST /api/v1/admin/change-requests',
      });
    }
    const position = await this.repo.getPosition(positionId);
    if (!position) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });

    const result = await this.repo.replaceCaps(positionId, body.grants ?? {}, actorEmail);
    const detail = await this.repo.buildPositionDetail(positionId);
    return {
      ok: true,
      position_id: positionId,
      position_code: position.code,
      added: result.added,
      removed: result.removed,
      diff: result.diff,
      position: detail,
    };
  }

  listAudit(positionId?: number, limit?: number) {
    return this.repo.listAudit(positionId, limit);
  }

  async exportPosition(positionId: number) {
    const detail = await this.repo.buildPositionDetail(positionId);
    if (!detail) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });
    const catalog = loadStaffPermissionCatalog();
    const lines = [
      `# Ma trận phân quyền — ${detail.code} (${detail.name})`,
      '',
      '| Nhóm | Section | Action |',
      '| --- | --- | --- |',
    ];
    for (const row of detail.matrix) {
      for (const action of row.allowed) {
        lines.push(
          `| ${row.group} | ${row.section_label} (${row.section_id}) | ${catalogActionLabel(action, catalog)} (${action}) |`,
        );
      }
    }
    return {
      format: 'markdown',
      position_id: detail.id,
      position_code: detail.code,
      position_name: detail.name,
      markdown: lines.join('\n'),
      grants: detail.grants,
      matrix: detail.matrix,
    };
  }

  listJobFunctions(): StaffJobFunctionSummary[] {
    return this.jobFunctions.listFunctions();
  }

  async getJobFunction(code: string): Promise<StaffJobFunctionDetail> {
    const detail = await this.jobFunctions.getFunction(code);
    if (!detail) throw new NotFoundException({ error: 'function_not_found', code });
    return {
      code: detail.code,
      label: detail.label,
      description: detail.description,
      department_scope: detail.department_scope,
      sort_order: detail.sort_order,
      grants_customized: detail.grants_customized,
      grants: detail.grants,
      matrix: detail.matrix,
    };
  }

  async patchJobFunction(code: string, body: PatchStaffJobFunctionGrantsBody, actorEmail: string) {
    const result = await this.jobFunctions.replaceGrants(code, body.grants ?? {}, actorEmail);
    await this.adminAudit.insertPermissionFunctionAudit(code, actorEmail, result.diff);
    const detail = await this.getJobFunction(code);
    return {
      ok: true,
      function_code: code,
      added: result.added,
      removed: result.removed,
      diff: result.diff,
      function: detail,
    };
  }

  async exportJobFunction(code: string) {
    const detail = await this.getJobFunction(code);
    const catalog = loadStaffPermissionCatalog();
    const lines = [
      `# Ma trận job function — ${detail.code} (${detail.label})`,
      '',
      '| Nhóm | Section | Action |',
      '| --- | --- | --- |',
    ];
    for (const row of detail.matrix) {
      for (const action of row.allowed) {
        lines.push(
          `| ${row.group} | ${row.section_label} (${row.section_id}) | ${catalogActionLabel(action, catalog)} (${action}) |`,
        );
      }
    }
    return {
      format: 'markdown',
      function_code: detail.code,
      function_label: detail.label,
      markdown: lines.join('\n'),
      grants: detail.grants,
      matrix: detail.matrix,
    };
  }
}
