import { Module } from '@nestjs/common';
import { OpsModule } from '../ops/ops.module';
import { PortalModule } from '../portal/portal.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { PortalOpsController } from './portal-ops.controller';
import { PortalOpsSummaryService } from './portal-ops-summary.service';

@Module({
  imports: [PortalModule, ServiceLifecycleModule, OpsModule],
  controllers: [PortalOpsController],
  providers: [PortalOpsSummaryService],
  exports: [PortalOpsSummaryService],
})
export class PortalOpsModule {}
