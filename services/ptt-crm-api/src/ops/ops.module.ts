import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { SpcModule } from '../spc/spc.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffOpsViewGuard } from './guards/staff-ops-view.guard';
import { StaffOpsWriteGuard } from './guards/staff-ops-write.guard';
import { OpsAgentCronService } from './ops-agent-cron.service';
import { OpsAgentScanService } from './ops-agent.scan.service';
import { OpsAlertPgRepository } from './ops-alert-pg.repository';
import { OpsController } from './ops.controller';
import { OpsDashboardService } from './ops-dashboard.service';
import { OpsKpiPgRepository } from './ops-kpi-pg.repository';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { OpsService } from './ops.service';
import { OpsWeeklyPgRepository } from './ops-weekly-pg.repository';

@Module({
  imports: [StaffAuthModule, SpcModule, forwardRef(() => ServiceLifecycleModule)],
  controllers: [OpsController],
  providers: [
    OpsService,
    OpsRouteMapLoader,
    OpsProfilePgRepository,
    OpsWeeklyPgRepository,
    OpsKpiPgRepository,
    OpsAlertPgRepository,
    OpsAgentScanService,
    OpsAgentCronService,
    OpsDashboardService,
    StaffOpsViewGuard,
    StaffOpsWriteGuard,
  ],
  exports: [
    OpsService,
    OpsRouteMapLoader,
    OpsProfilePgRepository,
    OpsAlertPgRepository,
    OpsWeeklyPgRepository,
    OpsKpiPgRepository,
  ],
})
export class OpsModule {}
