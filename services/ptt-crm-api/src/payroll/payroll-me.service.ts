import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { PayrollService } from './payroll.service';

@Injectable()
export class PayrollMeService {
  constructor(
    private readonly payroll: PayrollService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async resolveStaffId(payload: StaffJwtPayload | undefined): Promise<number> {
    const staffId = await this.staffAuth.resolveCrmStaffUserId(payload);
    if (!staffId) {
      throw new ForbiddenException({ error: 'staff_profile_not_linked', message: 'Không map được hồ sơ crm_staff.' });
    }
    return staffId;
  }

  async listPayslips(payload: StaffJwtPayload | undefined) {
    const staffId = await this.resolveStaffId(payload);
    return this.payroll.listMyPayslips(staffId);
  }

  async downloadPayslipXlsx(
    payload: StaffJwtPayload | undefined,
    yearRaw?: string,
    monthRaw?: string,
  ) {
    const staffId = await this.resolveStaffId(payload);
    const { year, month } = this.payroll.parseYearMonthPublic(yearRaw, monthRaw);
    try {
      return this.payroll.exportMyPayslipXlsx(staffId, year, month);
    } catch (err) {
      if (err instanceof Error && err.message === 'PAYSLIP_NOT_FOUND') {
        throw new NotFoundException({ error: 'payslip_not_found' });
      }
      throw err;
    }
  }
}
