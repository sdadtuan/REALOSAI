import { Module, forwardRef } from '@nestjs/common';
import { KpiModule } from '../kpi/kpi.module';
import { LeadsModule } from '../leads/leads.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CrmStaffController } from './crm-staff.controller';
import { CrmStaffPgRepository } from './crm-staff-pg.repository';
import { CrmStaffSqliteRepository } from './crm-staff-sqlite.repository';
import { CrmStaffService } from './crm-staff.service';
import {
  StaffRosterViewGuard,
  StaffRosterWriteGuard,
} from './guards/staff-roster.guard';
import { StaffKpiViewGuard } from '../kpi/guards/staff-kpi.guard';

@Module({
  imports: [StaffAuthModule, KpiModule, forwardRef(() => LeadsModule)],
  controllers: [CrmStaffController],
  providers: [
    CrmStaffService,
    CrmStaffSqliteRepository,
    CrmStaffPgRepository,
    StaffRosterViewGuard,
    StaffRosterWriteGuard,
    StaffKpiViewGuard,
  ],
  exports: [CrmStaffService],
})
export class CrmStaffModule {}
