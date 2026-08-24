import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffPayrollSalaryEditGuard,
  StaffPayrollSalaryExportGuard,
  StaffPayrollSalaryViewGuard,
  StaffPayrollViewGuard,
} from './guards/staff-payroll.guard';
import { PayrollController } from './payroll.controller';
import { PayrollMeController } from './payroll-me.controller';
import { PayrollMeService } from './payroll-me.service';
import { PayrollPgRepository } from './payroll-pg.repository';
import { PayrollService } from './payroll.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [PayrollController, PayrollMeController],
  providers: [
    PayrollService,
    PayrollMeService,
    PayrollPgRepository,
    StaffPayrollViewGuard,
    StaffPayrollSalaryViewGuard,
    StaffPayrollSalaryEditGuard,
    StaffPayrollSalaryExportGuard,
  ],
})
export class PayrollModule {}
