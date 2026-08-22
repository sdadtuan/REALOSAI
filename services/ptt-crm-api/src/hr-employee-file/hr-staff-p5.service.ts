import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrStaffP5Repository } from './hr-staff-p5.repository';
import type {
  CreateHrStaffDependentBody,
  HrStaffDependentRow,
  PatchHrStaffDependentBody,
  PatchHrStaffLifecycleBody,
} from './hr-staff-p5.types';
import {
  bodyContainsDependentPii,
  lifecycleStageLabel,
  maskDependentCccd,
} from './hr-staff-p5.util';

type DependentApiRow = HrStaffDependentRow & { cccd_masked?: boolean };

@Injectable()
export class HrStaffP5Service {
  constructor(
    private readonly p5Repo: HrStaffP5Repository,
    private readonly staffRepo: HrEmployeeFileRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async ensureReady(): Promise<void> {
    if (!(await this.p5Repo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_staff_p5_not_ready' });
    }
  }

  private async piiCaps(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    return {
      me,
      canViewPii: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'view'),
      canEditPii: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'edit'),
    };
  }

  private async rosterCaps(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    return {
      me,
      canViewRoster: this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view'),
      canEditRoster: this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
    };
  }

  private maskDependent(row: HrStaffDependentRow, canViewPii: boolean): DependentApiRow {
    const masked = Boolean(row.cccd?.trim()) && !canViewPii;
    return {
      ...row,
      cccd: maskDependentCccd(row.cccd, canViewPii),
      cccd_masked: masked || undefined,
    };
  }

  async listDependents(payload: StaffJwtPayload | undefined, staffId: number) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canViewPii } = await this.piiCaps(payload!);
    const rows = await this.p5Repo.listDependents(staffId);
    return {
      ok: true,
      dependents: rows.map((r) => this.maskDependent(r, canViewPii)),
    };
  }

  async createDependent(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    body: CreateHrStaffDependentBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditPii, canViewPii } = await this.piiCaps(payload!);
    if (!canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    if (!String(body.name ?? '').trim()) {
      throw new BadRequestException({ error: 'dependent_name_required' });
    }
    const row = await this.p5Repo.createDependent(staffId, body);
    return { ok: true, dependent: this.maskDependent(row, canViewPii) };
  }

  async patchDependent(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    dependentId: number,
    body: PatchHrStaffDependentBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditPii, canViewPii } = await this.piiCaps(payload!);
    if (!canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    if (bodyContainsDependentPii(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const row = await this.p5Repo.patchDependent(staffId, dependentId, body);
    return { ok: true, dependent: this.maskDependent(row, canViewPii) };
  }

  async deleteDependent(payload: StaffJwtPayload | undefined, staffId: number, dependentId: number) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditPii } = await this.piiCaps(payload!);
    if (!canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    await this.p5Repo.deleteDependent(staffId, dependentId);
    return { ok: true, deleted: true };
  }

  async getLifecycle(payload: StaffJwtPayload | undefined, staffId: number) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const row = await this.p5Repo.getLifecycle(staffId);
    const gate = row.stage === 'official' ? { ok: true, missing: [] as string[] } : await this.checkOfficialGate(staffId);
    return {
      ok: true,
      lifecycle: {
        ...row,
        stage_label: lifecycleStageLabel(row.stage),
      },
      official_gate: gate,
    };
  }

  async checkOfficialGate(staffId: number) {
    const missing = await this.p5Repo.checkOfficialGate(staffId);
    return { ok: missing.length === 0, missing };
  }

  async patchLifecycle(payload: StaffJwtPayload | undefined, staffId: number, body: PatchHrStaffLifecycleBody) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditRoster } = await this.rosterCaps(payload!);
    if (!canEditRoster) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster' });
    }
    if (body.stage === 'official') {
      const gate = await this.checkOfficialGate(staffId);
      if (!gate.ok) {
        throw new BadRequestException({ error: 'official_gate_blocked', missing: gate.missing });
      }
    }
    const row = await this.p5Repo.patchLifecycle(staffId, body);
    return {
      ok: true,
      lifecycle: {
        ...row,
        stage_label: lifecycleStageLabel(row.stage),
      },
    };
  }

  async hubExpirySummary(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canViewRoster } = await this.rosterCaps(payload!);
    if (!canViewRoster) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster' });
    }
    const summary = await this.p5Repo.hubExpirySummary();
    return { ok: true, summary };
  }

  async lifecycleSummaryForProfile(staffId: number) {
    if (!(await this.p5Repo.tablesReady())) return null;
    const row = await this.p5Repo.getLifecycle(staffId);
    return {
      stage: row.stage,
      stage_label: lifecycleStageLabel(row.stage),
      stage_changed_on: row.stage_changed_on,
    };
  }
}
