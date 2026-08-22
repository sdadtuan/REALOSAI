import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrLaborContractRepository } from './hr-labor-contract.repository';
import type {
  CreateHrLaborAppendixBody,
  CreateHrLaborContractBody,
  HrLaborContractAppendixRow,
  HrLaborContractRow,
  PatchHrLaborAppendixBody,
  PatchHrLaborContractBody,
} from './hr-labor-contract.types';
import { bodyContainsSalary, maskSalary } from './hr-labor-contract.util';

type ContractApiRow = HrLaborContractRow & { salary_masked?: boolean };
type AppendixApiRow = HrLaborContractAppendixRow & { salary_masked?: boolean };

@Injectable()
export class HrLaborContractService {
  constructor(
    private readonly contractRepo: HrLaborContractRepository,
    private readonly staffRepo: HrEmployeeFileRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async ensureReady(): Promise<void> {
    if (!(await this.contractRepo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_labor_contract_not_ready' });
    }
  }

  private async caps(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    const canViewContract =
      this.staffAuth.hasCap(me.caps, 'crm_hr_contract', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view');
    const canEditContract =
      this.staffAuth.hasCap(me.caps, 'crm_hr_contract', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit');
    const canViewPii = this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'view');
    const canEditPii = this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'edit');
    return { me, canViewContract, canEditContract, canViewPii, canEditPii };
  }

  private maskAppendix(row: HrLaborContractAppendixRow, canViewPii: boolean): AppendixApiRow {
    const masked = row.salary_gross != null && !canViewPii;
    return {
      ...row,
      salary_gross: maskSalary(row.salary_gross, canViewPii),
      salary_masked: masked || undefined,
    };
  }

  private maskContract(row: HrLaborContractRow, canViewPii: boolean): ContractApiRow {
    const masked = row.salary_gross != null && !canViewPii;
    return {
      ...row,
      salary_gross: maskSalary(row.salary_gross, canViewPii),
      salary_masked: masked || undefined,
      appendices: row.appendices.map((a) => this.maskAppendix(a, canViewPii)),
    };
  }

  async listContracts(payload: StaffJwtPayload | undefined, staffId: number) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canViewPii } = await this.caps(payload!);
    const contracts = await this.contractRepo.listForStaff(staffId);
    const active = await this.contractRepo.getActiveSummary(staffId);
    return {
      ok: true,
      contracts: contracts.map((c) => this.maskContract(c, canViewPii)),
      active_contract: active,
    };
  }

  async createContract(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    body: CreateHrLaborContractBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditContract, canEditPii } = await this.caps(payload!);
    if (!canEditContract) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_contract' });
    }
    if (bodyContainsSalary(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const { canViewPii } = await this.caps(payload!);
    const contract = await this.contractRepo.create(staffId, body);
    const active = await this.contractRepo.getActiveSummary(staffId);
    return { ok: true, contract: this.maskContract(contract, canViewPii), active_contract: active };
  }

  async patchContract(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    contractId: number,
    body: PatchHrLaborContractBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditContract, canEditPii, canViewPii } = await this.caps(payload!);
    if (!canEditContract) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_contract' });
    }
    if (bodyContainsSalary(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const contract = await this.contractRepo.patch(staffId, contractId, body);
    const active = await this.contractRepo.getActiveSummary(staffId);
    return { ok: true, contract: this.maskContract(contract, canViewPii), active_contract: active };
  }

  async createAppendix(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    contractId: number,
    body: CreateHrLaborAppendixBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditContract, canEditPii, canViewPii } = await this.caps(payload!);
    if (!canEditContract) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_contract' });
    }
    if (bodyContainsSalary(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const appendix = await this.contractRepo.createAppendix(staffId, contractId, body);
    return { ok: true, appendix: this.maskAppendix(appendix, canViewPii) };
  }

  async patchAppendix(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    contractId: number,
    appendixId: number,
    body: PatchHrLaborAppendixBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditContract, canEditPii, canViewPii } = await this.caps(payload!);
    if (!canEditContract) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_contract' });
    }
    if (bodyContainsSalary(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const appendix = await this.contractRepo.patchAppendix(staffId, contractId, appendixId, body);
    return { ok: true, appendix: this.maskAppendix(appendix, canViewPii) };
  }

  async getActiveSummary(staffId: number) {
    if (!(await this.contractRepo.tablesReady())) return null;
    return this.contractRepo.getActiveSummary(staffId);
  }
}
