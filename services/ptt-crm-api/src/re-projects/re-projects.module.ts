import { Module } from '@nestjs/common';
import { BdsModule } from '../bds/bds.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffReProjectsBudgetDeleteGuard,
  StaffReProjectsBudgetExportGuard,
  StaffReProjectsBudgetViewGuard,
  StaffReProjectsBudgetWriteGuard,
  StaffReProjectsDeleteGuard,
  StaffReProjectsExportGuard,
  StaffReProjectsKpiDeleteGuard,
  StaffReProjectsKpiViewGuard,
  StaffReProjectsKpiWriteGuard,
  StaffReProjectsProductsDeleteGuard,
  StaffReProjectsProductsViewGuard,
  StaffReProjectsProductsWriteGuard,
  StaffReProjectsRisksDeleteGuard,
  StaffReProjectsRisksViewGuard,
  StaffReProjectsRisksWriteGuard,
  StaffReProjectsUpdateGuard,
  StaffReProjectsLeadConfigViewGuard,
  StaffReProjectsLeadConfigWriteGuard,
  StaffReProjectsViewGuard,
  StaffReProjectsWriteGuard,
} from './guards/staff-re-projects.guard';
import { ReProjectsAccountingRepository } from './re-projects-accounting.repository';
import { ReProjectsAccountingService } from './re-projects-accounting.service';
import { ReProjectsController } from './re-projects.controller';
import { ReProjectsKpiBudgetService } from './re-projects-kpi-budget.service';
import { ReProjectsOpsService } from './re-projects-ops.service';
import { ReProjectsPgRepository } from './re-projects-pg.repository';
import { ReProjectsSqliteRepository } from './re-projects-sqlite.repository';
import { ReProjectsService } from './re-projects.service';

@Module({
  imports: [StaffAuthModule, BdsModule],
  controllers: [ReProjectsController],
  providers: [
    ReProjectsService,
    ReProjectsPgRepository,
    ReProjectsOpsService,
    ReProjectsKpiBudgetService,
    ReProjectsAccountingService,
    ReProjectsSqliteRepository,
    ReProjectsAccountingRepository,
    StaffReProjectsViewGuard,
    StaffReProjectsWriteGuard,
    StaffReProjectsLeadConfigViewGuard,
    StaffReProjectsLeadConfigWriteGuard,
    StaffReProjectsDeleteGuard,
    StaffReProjectsExportGuard,
    StaffReProjectsUpdateGuard,
    StaffReProjectsProductsViewGuard,
    StaffReProjectsProductsWriteGuard,
    StaffReProjectsProductsDeleteGuard,
    StaffReProjectsKpiViewGuard,
    StaffReProjectsKpiWriteGuard,
    StaffReProjectsKpiDeleteGuard,
    StaffReProjectsRisksViewGuard,
    StaffReProjectsRisksWriteGuard,
    StaffReProjectsRisksDeleteGuard,
    StaffReProjectsBudgetViewGuard,
    StaffReProjectsBudgetWriteGuard,
    StaffReProjectsBudgetDeleteGuard,
    StaffReProjectsBudgetExportGuard,
  ],
  exports: [ReProjectsService, ReProjectsOpsService, ReProjectsKpiBudgetService, ReProjectsAccountingService],
})
export class ReProjectsModule {}
