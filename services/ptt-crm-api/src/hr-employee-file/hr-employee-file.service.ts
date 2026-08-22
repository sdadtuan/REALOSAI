import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrDocWalletRepository } from './hr-doc-wallet.repository';
import { HrInsuranceRepository } from './hr-insurance.repository';
import { HrLaborContractRepository } from './hr-labor-contract.repository';
import { HrStaffP5Service } from './hr-staff-p5.service';
import type {
  HrStaffProfileResponse,
  PatchHrStaffIdentityBody,
  PutHrStaffAddressesBody,
} from './hr-employee-file.types';
import {
  bodyContainsPiiFields,
  computeProfileCompleteness,
  maskIdentityForApi,
} from './hr-employee-file.util';
import { computeWalletCompleteness, countExpiringCards } from './hr-doc-wallet.util';

@Injectable()
export class HrEmployeeFileService {
  constructor(
    private readonly repo: HrEmployeeFileRepository,
    private readonly walletRepo: HrDocWalletRepository,
    private readonly contractRepo: HrLaborContractRepository,
    private readonly insuranceRepo: HrInsuranceRepository,
    private readonly p5Service: HrStaffP5Service,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async ensureReady(): Promise<void> {
    if (!(await this.repo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_employee_file_not_ready' });
    }
  }

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async capsFor(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    return {
      me,
      canViewPii: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'view'),
      canEditPii: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'edit'),
      canEditRoster: this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
      canViewDocs:
        this.staffAuth.hasCap(me.caps, 'crm_hr_docs', 'view') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view'),
      canEditDocs:
        this.staffAuth.hasCap(me.caps, 'crm_hr_docs', 'edit') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
      canViewContract:
        this.staffAuth.hasCap(me.caps, 'crm_hr_contract', 'view') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view'),
      canEditContract:
        this.staffAuth.hasCap(me.caps, 'crm_hr_contract', 'edit') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
      canViewInsurance:
        this.staffAuth.hasCap(me.caps, 'crm_hr_insurance', 'view') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view'),
      canEditInsurance:
        this.staffAuth.hasCap(me.caps, 'crm_hr_insurance', 'edit') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
      canViewDependents: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'view'),
      canEditDependents: this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'edit'),
      canViewAttendance:
        this.staffAuth.hasCap(me.caps, 'crm_payroll_attendance', 'view') ||
        this.staffAuth.hasCap(me.caps, 'crm_hr_attendance', 'device') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view'),
      canManageAttendanceDevice:
        this.staffAuth.hasCap(me.caps, 'crm_hr_attendance', 'device') ||
        this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit'),
    };
  }

  private async walletSummary(staffId: number) {
    if (!(await this.walletRepo.walletTablesReady())) {
      return { wallet_pct: 0, expiring_count: 0 };
    }
    const types = await this.walletRepo.listRequiredTypes();
    const cards = await this.walletRepo.listCards(staffId);
    return {
      wallet_pct: computeWalletCompleteness(types, cards),
      expiring_count: countExpiringCards(cards),
    };
  }

  async getProfile(
    payload: StaffJwtPayload | undefined,
    staffId: number,
  ): Promise<HrStaffProfileResponse> {
    this.requireUser(payload);
    await this.ensureReady();
    const staff = await this.repo.assertStaffExists(staffId);
    const {
      canViewPii,
      canEditPii,
      canEditRoster,
      canViewDocs,
      canEditDocs,
      canViewContract,
      canEditContract,
      canViewInsurance,
      canEditInsurance,
      canViewDependents,
      canEditDependents,
      canViewAttendance,
      canManageAttendanceDevice,
    } = await this.capsFor(payload!);
    const identityRow = await this.repo.getIdentity(staffId);
    const addresses = await this.repo.listAddresses(staffId);
    const identity = maskIdentityForApi(identityRow, canViewPii);
    const profilePct = computeProfileCompleteness(identityRow, addresses);
    const walletReady = await this.walletRepo.walletTablesReady();
    const wallet = walletReady ? await this.walletSummary(staffId) : { wallet_pct: 0, expiring_count: 0 };
    const completeness_pct = walletReady ? wallet.wallet_pct : profilePct;
    const contractReady = await this.contractRepo.tablesReady();
    const active_contract = contractReady ? await this.contractRepo.getActiveSummary(staffId) : null;
    const insuranceReady = await this.insuranceRepo.tablesReady();
    const insurance_summary = insuranceReady ? await this.insuranceRepo.getSummary(staffId) : null;
    const lifecycle_summary = await this.p5Service.lifecycleSummaryForProfile(staffId);
    return {
      ok: true,
      staff,
      identity,
      addresses,
      completeness_pct,
      wallet_pct: wallet.wallet_pct,
      expiring_count: wallet.expiring_count,
      active_contract,
      insurance_summary,
      lifecycle_summary,
      can_view_pii: canViewPii,
      can_edit_pii: canEditPii,
      can_edit_roster: canEditRoster,
      can_view_docs: canViewDocs,
      can_edit_docs: canEditDocs,
      can_view_contract: canViewContract,
      can_edit_contract: canEditContract,
      can_view_insurance: canViewInsurance,
      can_edit_insurance: canEditInsurance,
      can_view_dependents: canViewDependents,
      can_edit_dependents: canEditDependents,
      can_view_attendance: canViewAttendance,
      can_manage_attendance_device: canManageAttendanceDevice,
    };
  }

  async patchIdentity(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    body: PatchHrStaffIdentityBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.repo.assertStaffExists(staffId);
    const { canEditPii, canEditRoster } = await this.capsFor(user);
    if (!canEditRoster) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster' });
    }
    if (bodyContainsPiiFields(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }

    const row = await this.repo.upsertIdentity(staffId, body);
    if (bodyContainsPiiFields(body as Record<string, unknown>)) {
      await this.repo.logPiiAudit({
        staffId,
        actorUserId: user.sub,
        actorEmail: user.email ?? '',
        action: 'patch_identity_pii',
        section: 'identity',
        meta: { fields: Object.keys(body).filter((k) =>
          ['cccd', 'tax_code', 'bank_name', 'bank_account', 'bank_holder'].includes(k),
        ) },
      });
    }

    const { canViewPii } = await this.capsFor(user);
    const addresses = await this.repo.listAddresses(staffId);
    return {
      ok: true,
      identity: maskIdentityForApi(row, canViewPii),
      completeness_pct: computeProfileCompleteness(row, addresses),
    };
  }

  async putAddresses(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    body: PutHrStaffAddressesBody,
  ) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.repo.assertStaffExists(staffId);
    const { canEditRoster } = await this.capsFor(user);
    if (!canEditRoster) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster' });
    }
    const addresses = body.addresses ?? [];
    if (!addresses.length) {
      throw new NotFoundException({ error: 'addresses_required' });
    }
    const rows = await this.repo.putAddresses(staffId, addresses);
    const identityRow = await this.repo.getIdentity(staffId);
    return {
      ok: true,
      addresses: rows,
      completeness_pct: computeProfileCompleteness(identityRow, rows),
    };
  }
}
