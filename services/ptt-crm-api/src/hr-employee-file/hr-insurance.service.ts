import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrInsuranceRepository } from './hr-insurance.repository';
import type {
  CreateHrInsurancePeriodBody,
  HrInsurancePeriodRow,
  HrStaffInsuranceRow,
  PatchHrInsurancePeriodBody,
  PutHrStaffInsuranceBody,
} from './hr-insurance.types';
import {
  bodyContainsInsurancePii,
  bodyContainsPeriodSalary,
  maskInsuranceNo,
} from './hr-insurance.util';
import { maskSalary } from './hr-labor-contract.util';

type InsuranceApiRow = HrStaffInsuranceRow & {
  bhxh_book_no_masked?: boolean;
  bhyt_card_no_masked?: boolean;
};

type PeriodApiRow = HrInsurancePeriodRow & { salary_masked?: boolean };

@Injectable()
export class HrInsuranceService {
  constructor(
    private readonly insuranceRepo: HrInsuranceRepository,
    private readonly staffRepo: HrEmployeeFileRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async ensureReady(): Promise<void> {
    if (!(await this.insuranceRepo.tablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_insurance_not_ready' });
    }
  }

  private async caps(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    const canViewInsurance =
      this.staffAuth.hasCap(me.caps, 'crm_hr_insurance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view');
    const canEditInsurance =
      this.staffAuth.hasCap(me.caps, 'crm_hr_insurance', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit');
    const canViewPii = this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'view');
    const canEditPii = this.staffAuth.hasCap(me.caps, 'crm_hr_pii', 'edit');
    return { me, canViewInsurance, canEditInsurance, canViewPii, canEditPii };
  }

  private maskInsurance(row: HrStaffInsuranceRow, canViewPii: boolean): InsuranceApiRow {
    const bhxhMasked = Boolean(row.bhxh_book_no?.trim()) && !canViewPii;
    const bhytMasked = Boolean(row.bhyt_card_no?.trim()) && !canViewPii;
    return {
      ...row,
      bhxh_book_no: maskInsuranceNo(row.bhxh_book_no, canViewPii),
      bhyt_card_no: maskInsuranceNo(row.bhyt_card_no, canViewPii),
      bhxh_book_no_masked: bhxhMasked || undefined,
      bhyt_card_no_masked: bhytMasked || undefined,
    };
  }

  private maskPeriod(row: HrInsurancePeriodRow, canViewPii: boolean): PeriodApiRow {
    const masked = row.salary_base != null && !canViewPii;
    return {
      ...row,
      salary_base: maskSalary(row.salary_base, canViewPii),
      salary_masked: masked || undefined,
    };
  }

  async getInsurance(payload: StaffJwtPayload | undefined, staffId: number) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canViewPii } = await this.caps(payload!);
    const register = await this.insuranceRepo.getForStaff(staffId);
    const periods = await this.insuranceRepo.listPeriods(staffId);
    const summary = await this.insuranceRepo.getSummary(staffId);
    return {
      ok: true,
      register: this.maskInsurance(register, canViewPii),
      periods: periods.map((p) => this.maskPeriod(p, canViewPii)),
      summary,
    };
  }

  async putInsurance(payload: StaffJwtPayload | undefined, staffId: number, body: PutHrStaffInsuranceBody) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditInsurance, canEditPii, canViewPii } = await this.caps(payload!);
    if (!canEditInsurance) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_insurance' });
    }
    if (bodyContainsInsurancePii(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const register = await this.insuranceRepo.upsert(staffId, body);
    const summary = await this.insuranceRepo.getSummary(staffId);
    return {
      ok: true,
      register: this.maskInsurance(register, canViewPii),
      summary,
    };
  }

  async createPeriod(payload: StaffJwtPayload | undefined, staffId: number, body: CreateHrInsurancePeriodBody) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditInsurance, canEditPii, canViewPii } = await this.caps(payload!);
    if (!canEditInsurance) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_insurance' });
    }
    if (bodyContainsPeriodSalary(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const period = await this.insuranceRepo.createPeriod(staffId, body);
    return { ok: true, period: this.maskPeriod(period, canViewPii) };
  }

  async patchPeriod(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    periodId: number,
    body: PatchHrInsurancePeriodBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.staffRepo.assertStaffExists(staffId);
    const { canEditInsurance, canEditPii, canViewPii } = await this.caps(payload!);
    if (!canEditInsurance) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_insurance' });
    }
    if (bodyContainsPeriodSalary(body as Record<string, unknown>) && !canEditPii) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_pii' });
    }
    const period = await this.insuranceRepo.patchPeriod(staffId, periodId, body);
    return { ok: true, period: this.maskPeriod(period, canViewPii) };
  }

  async getSummary(staffId: number) {
    if (!(await this.insuranceRepo.tablesReady())) return null;
    return this.insuranceRepo.getSummary(staffId);
  }
}
